import { BrowserWindow, WebContentsView } from "electron";
import { MainRuntime } from "@/lib/runtime";
import { MainWindowConstants } from "@/constants/window";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainWebSearchPageConstants } from "@/constants/web";
import { boundWebPageCache, paginateWebOutput } from "@/utils/web-page";

import { WebBrowserError } from "./web-browser-error";
import { WebBrowserSession } from "./web-browser-session";
import { createWebPageSnapshotScript } from "./web-page-snapshot";
import { parsePublicWebURL, assertPublicWebURL } from "./web-url-safety";
import { createWebContentReadyScript, type WebContentReadyOptions } from "./web-page-ready";
import {
  extractWebPage,
  createWebPageExtractionScript,
  type WebPageExtractionOptions,
  createWebSearchExtractionScript
} from "./web-page-extractor";

type WebPageData = ReturnType<typeof extractWebPage>;
type BrowserPage = {
  id: string;
  lastUsed: number;
  deadline?: number;
  pendingCount: number;
  view: WebContentsView;
  pending: Promise<void>;
  timer?: NodeJS.Timeout;
  cache: Map<string, WebPageData>;
  browserSession: WebBrowserSession;
};

export interface WebPageReadOptions extends Omit<WebPageExtractionOptions, "include_content"> {
  url?: string;
  cursor?: number;
  page_id?: string;
  max_chars?: number;
}

export class WebBrowser {
  private static window: undefined | BrowserWindow;
  private static activeView: undefined | WebContentsView;
  private static pages = new Map<string, BrowserPage>();
  private static sequence = 0;
  private static accessSequence = 0;
  private static currentPageId: string | undefined;
  private static generation = 0;
  private static browserSession?: WebBrowserSession;
  private static sessionFailures = 0;
  private static sessionRetryAt = 0;

  /** 在调用时固定页面；同页串行，不同页互不阻塞。 */
  private static enqueue<T>(
    page: BrowserPage,
    operation: () => T | Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    const generation = this.generation;
    page.pendingCount++;
    if (page.timer) clearTimeout(page.timer);
    const pending = page.pending.then(async () => {
      try {
        await page.browserSession.ready;
      } catch (error) {
        throw new WebBrowserError(
          "service",
          error instanceof Error ? error.message : String(error)
        );
      }
      this.check_aborted(signal);
      if (
        generation !== this.generation ||
        this.pages.get(page.id) !== page ||
        page.view.webContents.isDestroyed()
      )
        throw new DOMException("浏览器页面已关闭，工具请求已取消", "AbortError");
      this.refresh_timer(page);
      page.deadline = Date.now() + 20_000;
      return operation();
    });
    page.pending = pending.then(
      () => this.finish_operation(page),
      () => this.finish_operation(page)
    );
    if (!signal) return pending;
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(new DOMException("网页操作已取消", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      // 对外立即取消，但同页队列仍等待前序操作完成后再跳过此请求。
      pending.then(
        (result) => {
          signal.removeEventListener("abort", abort);
          resolve(result);
        },
        (error) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        }
      );
    });
  }

  private static check_aborted(signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("网页操作已取消", "AbortError");
  }

  private static refresh_timer(page: BrowserPage) {
    if (page.timer) clearTimeout(page.timer);
    page.lastUsed = ++this.accessSequence;
    if (!page.pendingCount) page.timer = setTimeout(() => this.close_page(page.id), 60_000);
  }

  private static finish_operation(page: BrowserPage) {
    page.pendingCount--;
    page.deadline = undefined;
    if (this.pages.get(page.id) === page) this.refresh_timer(page);
  }

  static get win() {
    this.page();
    return this.window!;
  }

  private static ensure_window() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.display
    );
    const win = new BrowserWindow({
      width: base.width,
      height: base.height,
      minWidth: min.width,
      minHeight: min.height,
      title: process.env.APP_NAME,
      show: MainRuntime.isDev,
      titleBarStyle: "hidden",
      webPreferences: {
        session: this.browserSession!.session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    this.window = win;
    win.on("resize", () => this.resize_view());
    win.once("closed", () => {
      if (this.window === win) this.close();
    });
    return win;
  }

  private static resize_view() {
    if (!this.window || this.window.isDestroyed() || !this.activeView) return;
    const { width, height } = this.window.getContentBounds();
    this.activeView.setBounds({ x: 0, y: 0, width, height });
  }

  private static select_page(page: BrowserPage) {
    const win = this.ensure_window();
    if (this.activeView !== page.view) {
      if (this.activeView) win.contentView.removeChildView(this.activeView);
      win.contentView.addChildView(page.view);
      this.activeView = page.view;
    }
    this.currentPageId = page.id;
    this.resize_view();
  }

  private static page(pageId?: string, create = false, signal?: AbortSignal): BrowserPage {
    this.check_aborted(signal);
    const id = pageId || (!create ? this.currentPageId : undefined);
    if (id) {
      const page = this.pages.get(id);
      if (page && !page.view.webContents.isDestroyed()) {
        this.select_page(page);
        this.refresh_timer(page);
        return page;
      }
      this.close_page(id);
      if (pageId)
        throw new WebBrowserError("page_expired", `页面 ${pageId} 已关闭或过期，请重新打开 URL`);
    }
    if (this.pages.size >= 6) {
      const idle = [...this.pages.values()]
        .filter((page) => !page.pendingCount)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (!idle) throw new WebBrowserError("busy", "六个网页均有待完成操作，请稍后重试或关闭页面");
      this.close_page(idle.id);
    }
    const browserSession = this.ensure_session();
    const page: BrowserPage = {
      id: `page-${++this.sequence}`,
      view: new WebContentsView({
        webPreferences: {
          session: browserSession.session,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          webviewTag: false
        }
      }),
      cache: new Map(),
      pending: Promise.resolve(),
      pendingCount: 0,
      lastUsed: 0,
      browserSession
    };
    WebBrowserSession.protectWebContents(page.view.webContents);
    this.pages.set(page.id, page);
    page.view.webContents.once("destroyed", () => this.close_page(page.id));
    page.view.webContents.once("render-process-gone", () => this.close_page(page.id));
    this.select_page(page);
    this.refresh_timer(page);
    return page;
  }

  private static ensure_session(): WebBrowserSession {
    if (this.browserSession) return this.browserSession;
    if (Date.now() < this.sessionRetryAt)
      throw new WebBrowserError("service", "网页代理初始化失败，正在等待重试，请稍后再试");
    let current: WebBrowserSession;
    try {
      current = new WebBrowserSession();
    } catch (error) {
      this.defer_session_retry();
      throw new WebBrowserError("service", error instanceof Error ? error.message : String(error));
    }
    this.browserSession = current;
    void current.ready.then(
      () => {
        if (this.browserSession !== current) return;
        this.sessionFailures = 0;
        this.sessionRetryAt = 0;
      },
      () => {
        if (this.browserSession !== current) return;
        this.defer_session_retry();
        this.browserSession = undefined;
        // 包含只创建但尚未入队的页面，避免它们继续持有失败的 Session。
        for (const page of this.pages.values()) {
          if (page.browserSession === current) this.close_page(page.id);
        }
        void current.close().catch((error) => console.warn("WebBrowser session cleanup", error));
      }
    );
    return current;
  }

  private static defer_session_retry() {
    this.sessionFailures++;
    this.sessionRetryAt =
      Date.now() + Math.min(500 * 2 ** Math.min(this.sessionFailures - 1, 5), 10_000);
  }

  private static validate_url(url: string) {
    parsePublicWebURL(url);
  }

  static async navigate(url: string, pageId?: string, signal?: AbortSignal) {
    this.validate_url(url);
    const page = this.page(pageId, false, signal);
    return this.enqueue(page, () => this.navigate_page(page, url, signal), signal);
  }

  static async open(url: string, pageId?: string, signal?: AbortSignal) {
    this.validate_url(url);
    const page = this.page(pageId, false, signal);
    return this.enqueue(
      page,
      async () => {
        await this.navigate_page(page, url, signal);
        return this.snapshot_page(page, signal);
      },
      signal
    );
  }

  private static async navigate_page(page: BrowserPage, url: string, signal?: AbortSignal) {
    const contents = page.view.webContents;
    page.cache.clear();
    await this.with_timeout(
      page,
      async () => {
        await assertPublicWebURL(url);
        this.check_aborted(signal);
        if (contents.isDestroyed()) throw new DOMException("浏览器页面已关闭", "AbortError");
        return new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            contents.off("dom-ready", ready);
            contents.off("destroyed", closed);
            if (error) reject(error);
            else resolve();
          };
          const closed = () => finish(new Error("浏览器页面已关闭"));
          // 导航完成与正文就绪分别处理；保留页面异步请求供 SPA 渲染。
          const ready = () => finish();
          contents.once("dom-ready", ready);
          contents.once("destroyed", closed);
          contents.loadURL(url).then(
            () => finish(),
            (error) => finish(error)
          );
        });
      },
      signal
    );
    this.check_aborted(signal);
    if (MainRuntime.isDev) contents.openDevTools();
    return { pageId: page.id, url: contents.getURL() };
  }

  static async snapshot(pageId?: string, signal?: AbortSignal) {
    const page = this.page(pageId, false, signal);
    return this.enqueue(page, () => this.snapshot_page(page, signal), signal);
  }

  private static async wait_content_ready(
    page: BrowserPage,
    options: WebContentReadyOptions,
    signal?: AbortSignal
  ) {
    const remaining = Math.max(0, (page.deadline ?? Date.now() + 20_000) - Date.now());
    const result = await this.run_script<{ ready: boolean }>(
      page,
      createWebContentReadyScript(options, Math.min(2_000, remaining)),
      signal
    );
    return result.ready;
  }

  private static async snapshot_page(page: BrowserPage, signal?: AbortSignal) {
    const ready = await this.wait_content_ready(page, {}, signal);
    const output = await this.run_script<{
      url: string;
      title: string;
      snapshot: string;
      sourceTruncated: boolean;
    }>(page, createWebPageSnapshotScript(), signal);
    return {
      pageId: page.id,
      ...output,
      ...(!ready ? { warnings: ["内容就绪等待已到期，当前快照可能仍在加载"] } : {})
    };
  }

  static async execute_script<T = unknown>(
    js: string,
    pageId?: string,
    signal?: AbortSignal
  ): Promise<T> {
    const page = this.page(pageId, false, signal);
    return this.enqueue(
      page,
      () => {
        page.cache.clear();
        return this.run_script<T>(page, js, signal, false);
      },
      signal
    );
  }

  private static async run_script<T>(
    page: BrowserPage,
    js: string,
    signal?: AbortSignal,
    isolated = true
  ): Promise<T> {
    const contents = page.view.webContents;
    return this.with_timeout(
      page,
      async () => {
        // 新建页面尚无已加载文档，必须先加载才能执行脚本。
        if (!contents.getURL()) await contents.loadURL("about:blank");
        this.check_aborted(signal);
        if (contents.isDestroyed()) throw new DOMException("浏览器页面已关闭", "AbortError");
        try {
          return isolated
            ? await contents.executeJavaScriptInIsolatedWorld(999, [{ code: js }])
            : await contents.executeJavaScript(js);
        } catch (error) {
          throw new WebBrowserError(
            "script_error",
            error instanceof Error ? error.message : String(error)
          );
        }
      },
      signal
    );
  }

  static close() {
    this.generation++;
    const window = this.window;
    const browserSession = this.browserSession;
    this.browserSession = undefined;
    this.window = undefined;
    this.activeView = undefined;
    this.currentPageId = undefined;
    for (const id of this.pages.keys()) this.close_page(id);
    if (window && !window.isDestroyed()) window.destroy();
    void browserSession
      ?.close()
      .catch((error) => console.warn("WebBrowser session cleanup", error));
  }

  static close_page(pageId: string) {
    const page = this.pages.get(pageId);
    if (!page) return { pageId, closed: false };
    if (page.timer) clearTimeout(page.timer);
    page.cache.clear();
    this.pages.delete(pageId);
    if (this.currentPageId === pageId) this.currentPageId = undefined;
    if (this.activeView === page.view) {
      if (this.window && !this.window.isDestroyed())
        this.window.contentView.removeChildView(page.view);
      this.activeView = undefined;
      this.currentPageId = undefined;
    }
    if (!page.view.webContents.isDestroyed()) page.view.webContents.close();
    if (this.window && !this.window.isDestroyed()) {
      if (!this.pages.size) this.window.destroy();
      else if (!this.activeView) this.select_page([...this.pages.values()].at(-1)!);
    }
    return { pageId, closed: true };
  }

  static async read_page(options: WebPageReadOptions = {}, signal?: AbortSignal) {
    if (options.cursor && options.url && !options.page_id)
      throw new WebBrowserError("invalid_input", "续读需要上一结果的 pageId");
    if (options.url) this.validate_url(options.url);
    const page = this.page(options.page_id, !!options.url && !options.page_id, signal);
    return this.enqueue(
      page,
      async () => {
        if (options.url && !options.cursor) await this.navigate_page(page, options.url, signal);
        this.check_aborted(signal);
        const format = options.format || "markdown";
        const extraction = {
          format,
          selector: options.selector,
          keyword: options.keyword,
          include_content: true,
          include_links: options.include_links ?? false,
          include_images: options.include_images ?? false
        };
        const key = JSON.stringify(extraction);
        let data = options.cursor ? page.cache.get(key) : undefined;
        let ready = true;
        if (!data) {
          if (options.cursor)
            throw new WebBrowserError(
              "cache_expired",
              "正文缓存已失效，请从 cursor=0 重新读取并保持相同提取选项"
            );
          ready = await this.wait_content_ready(
            page,
            { selector: options.selector, keyword: options.keyword },
            signal
          );
          data = await this.run_script<WebPageData>(
            page,
            createWebPageExtractionScript(extraction),
            signal
          );
          this.check_aborted(signal);
          data = boundWebPageCache(data);
          // 分页始终基于同一份正文与附加信息。
          page.cache.delete(key);
          const size = JSON.stringify(data).length;
          let used = [...page.cache.values()].reduce(
            (total, entry) => total + JSON.stringify(entry).length,
            0
          );
          while (
            page.cache.size &&
            (page.cache.size >= 4 || used + size > MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS)
          ) {
            const oldest = page.cache.keys().next().value!;
            used -= JSON.stringify(page.cache.get(oldest)).length;
            page.cache.delete(oldest);
          }
          page.cache.set(key, data);
        }
        return paginateWebOutput(
          {
            pageId: page.id,
            url: data.url,
            title: data.title.slice(0, 500),
            publishedAt: data.publishedAt,
            format,
            sourceTruncated: data.sourceTruncated,
            ...(!ready || data.content.length < 100 || /loading\.\.\./i.test(data.content)
              ? { warnings: ["正文较短或仍含加载占位文字，可稍后重读或打开具体内容页"] }
              : {}),
            ...(options.include_links
              ? {
                  links: data.links.slice(0, MainWebSearchPageConstants.MAX_LINKS),
                  linksTotal: data.links.length
                }
              : {}),
            ...(options.include_images
              ? {
                  images: data.images.slice(0, MainWebSearchPageConstants.MAX_IMAGES),
                  imagesTotal: data.images.length
                }
              : {})
          },
          data.content,
          options.cursor,
          options.max_chars ?? MainWebSearchPageConstants.DEFAULT_CONTENT_CHARS
        );
      },
      signal
    );
  }

  static read_section(options: WebPageReadOptions, signal?: AbortSignal) {
    if (!options.selector && !options.keyword)
      throw new WebBrowserError("invalid_input", "分段读取需要 selector 或 keyword");
    return this.read_page(options, signal);
  }

  static async get_images(
    options: {
      url?: string;
      limit?: number;
      offset?: number;
      page_id?: string;
      selector?: string;
    } = {},
    signal?: AbortSignal
  ) {
    if (options.url) this.validate_url(options.url);
    const page = this.page(options.page_id, !!options.url && !options.page_id, signal);
    return this.enqueue(
      page,
      async () => {
        if (options.url) await this.navigate_page(page, options.url, signal);
        const ready = await this.wait_content_ready(
          page,
          { selector: options.selector, images: true },
          signal
        );
        const data = await this.run_script<WebPageData>(
          page,
          createWebPageExtractionScript({
            selector: options.selector,
            include_content: false,
            include_links: false,
            include_images: true
          }),
          signal
        );
        const offset = options.offset ?? 0;
        const limit = options.limit ?? MainWebSearchPageConstants.DEFAULT_ITEMS;
        let images = data.images.slice(offset, offset + limit);
        // 懒加载图片可能尚无尺寸，仅检查本次返回的图片，最多等待一秒。
        if (images.some((image) => !image.width || !image.height)) {
          images = await this.run_script<typeof images>(
            page,
            `Promise.all(${JSON.stringify(images)}.map(image => {
        if (image.width && image.height) return image;
        return new Promise(resolve => {
          const img = new Image();
          const finish = () => { clearTimeout(timer); img.onload = img.onerror = null; resolve({...image, width: img.naturalWidth || image.width, height: img.naturalHeight || image.height}); };
          const timer = setTimeout(finish, 1000);
          img.onload = img.onerror = finish;
          img.src = image.url;
        });
      }))`,
            signal
          );
        }
        return {
          pageId: page.id,
          url: data.url,
          title: data.title,
          sourceTruncated: data.sourceTruncated,
          ...(!ready ? { warnings: ["内容就绪等待已到期，图片可能尚未全部加载"] } : {}),
          images,
          total: data.images.length,
          hasMore: offset + images.length < data.images.length,
          nextOffset: offset + images.length < data.images.length ? offset + images.length : null
        };
      },
      signal
    );
  }

  static async search(
    options: {
      query: string;
      site?: string;
      limit?: number;
      engine?: "bing" | "baidu" | "duckduckgo";
    },
    signal?: AbortSignal
  ) {
    const query = [options.query.trim(), options.site ? `site:${options.site}` : ""]
      .filter(Boolean)
      .join(" ");
    if (!options.query.trim()) throw new WebBrowserError("invalid_input", "搜索关键词不能为空");
    const engine = options.engine ?? "bing";
    const url = new URL(
      engine === "bing"
        ? "https://www.bing.com/search"
        : engine === "baidu"
          ? "https://www.baidu.com/s"
          : "https://html.duckduckgo.com/html/"
    );
    url.searchParams.set(engine === "baidu" ? "wd" : "q", query);
    const page = this.page(undefined, true, signal);
    return this.enqueue(
      page,
      async () => {
        await this.navigate_page(page, url.href, signal);
        const ready = await this.wait_content_ready(page, { engine }, signal);
        const result = await this.run_script<
          ReturnType<typeof import("./web-page-extractor").extractWebSearch>
        >(
          page,
          createWebSearchExtractionScript(
            engine,
            options.limit ?? MainWebSearchPageConstants.DEFAULT_ITEMS
          ),
          signal
        );
        const currentURL = page.view.webContents.getURL();
        return {
          pageId: page.id,
          url: currentURL.length <= 2_048 ? currentURL : "",
          query,
          engine,
          ...result,
          sourceTruncated: result.sourceTruncated || currentURL.length > 2_048,
          ...(!ready ? { warnings: ["搜索结果等待已到期，当前页面可能仍在加载"] } : {})
        };
      },
      signal
    );
  }

  private static async with_timeout<T>(
    page: BrowserPage,
    operation: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    this.check_aborted(signal);
    const contents = page.view.webContents;
    if (contents.isDestroyed()) throw new DOMException("浏览器页面已关闭", "AbortError");
    let timer: Undefinable<ReturnType<typeof setTimeout>>;
    let closed: () => void;
    let abort: () => void;
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => {
          closed = () => reject(new DOMException("浏览器页面已关闭", "AbortError"));
          contents.once("destroyed", closed);
          abort = () => {
            reject(new DOMException("网页操作已取消", "AbortError"));
            // executeJavaScript 没有取消接口，销毁当前页以停止在途脚本和导航。
            this.close_page(page.id);
          };
          signal?.addEventListener("abort", abort, { once: true });
          timer = setTimeout(
            () => {
              reject(new WebBrowserError("timeout", "网页操作超时（20 秒），当前页面已重置"));
              this.close_page(page.id);
            },
            Math.max(0, (page.deadline ?? Date.now() + 20_000) - Date.now())
          );
        }),
        operation().catch((error: unknown) => {
          // Electron 可能先拒绝脚本请求，再发出 destroyed；已移除的页面仍属于取消。
          if (this.pages.get(page.id) !== page || contents.isDestroyed())
            throw new DOMException("浏览器页面已关闭", "AbortError");
          throw error;
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      contents.off("destroyed", closed!);
      signal?.removeEventListener("abort", abort!);
    }
  }
}
