const { views, runtime, windows, browserSessions } = vi.hoisted(() => ({
  windows: [] as any[],
  views: [] as any[],
  browserSessions: [] as any[],
  runtime: { isDev: false, sessionReady: undefined as undefined | Promise<void> }
}));

vi.mock("@/lib/web-browser-session", () => ({
  WebBrowserSession: class {
    readonly session = {};
    readonly ready = runtime.sessionReady ?? Promise.resolve();
    readonly close = vi.fn().mockResolvedValue(undefined);
    static protectWebContents = vi.fn();
    constructor() {
      browserSessions.push(this);
    }
  }
}));
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ family: 4, address: "93.184.216.34" }])
}));
vi.mock("node:os", () => ({ networkInterfaces: () => ({}) }));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  class Contents extends EventEmitter {
    destroyed = false;
    url = "";
    getURL = () => this.url;
    isDestroyed = () => this.destroyed;
    executeJavaScript = vi.fn().mockResolvedValue(3);
    executeJavaScriptInIsolatedWorld = vi.fn((_world: number, scripts: Array<{ code: string }>) =>
      scripts[0]!.code.startsWith("/*aira-content-ready*/")
        ? Promise.resolve({ ready: true })
        : this.executeJavaScript(scripts[0]!.code)
    );
    openDevTools = vi.fn();
    stop = vi.fn();
    loadURL = vi.fn(async (url: string) => {
      this.url = url;
    });
    close = vi.fn(() => {
      this.destroyed = true;
      this.emit("destroyed");
    });
  }
  return {
    BrowserWindow: class extends EventEmitter {
      destroyed = false;
      bounds = { x: 10, y: 20, width: 800, height: 600 };
      contentView = { addChildView: vi.fn(), removeChildView: vi.fn() };
      getContentBounds = () => this.bounds;
      isDestroyed = () => this.destroyed;
      destroy = vi.fn(() => {
        this.destroyed = true;
        this.emit("closed");
      });
      constructor(readonly options: unknown) {
        super();
        windows.push(this);
      }
    },
    WebContentsView: class {
      webContents = new Contents();
      setBounds = vi.fn();
      constructor(readonly options: unknown) {
        views.push(this);
      }
    }
  };
});
vi.mock("@/lib/runtime", () => ({ MainRuntime: runtime }));
vi.mock("@mahiru/ipc/main", () => ({ MainIPC: { MessageChannel: {} } }));
vi.mock("@/lib/screen-resolver", () => ({
  MainScreenResolver: {
    primary: {
      adaptiveWindowSizePreset: () => ({
        min: { width: 100, height: 100 },
        base: { width: 800, height: 600 }
      })
    }
  }
}));

const pageData = {
  url: "https://example.com/a",
  title: "A",
  publishedAt: null,
  content: "abcdef" + "x".repeat(100),
  sourceTruncated: false,
  links: [],
  images: []
};

describe("WebBrowser 窗口生命周期", () => {
  beforeEach(() => {
    vi.resetModules();
    windows.length = 0;
    views.length = 0;
    browserSessions.length = 0;
    runtime.isDev = false;
    runtime.sessionReady = undefined;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("初始化失败会清理同 Session 的闲置页，退避后无需关闭 Agent 窗口即可重建", async () => {
    const ready = Promise.withResolvers<void>();
    runtime.sessionReady = ready.promise;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const pending = WebBrowser.search({ query: "test" });
    const assertion = expect(pending).rejects.toMatchObject({ code: "service" });
    expect(views).toHaveLength(2);
    ready.reject(new Error("EMFILE"));
    await assertion;
    for (const view of views) expect(view.webContents.close).toHaveBeenCalledOnce();
    expect(browserSessions[0].close).toHaveBeenCalledOnce();
    runtime.sessionReady = undefined;
    await expect(WebBrowser.navigate("https://example.com/a")).rejects.toMatchObject({
      code: "service"
    });
    expect(browserSessions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    await expect(WebBrowser.navigate("https://example.com/a")).resolves.toMatchObject({
      pageId: "page-3"
    });
    expect(browserSessions).toHaveLength(2);
    WebBrowser.close();
  });

  it("旧 Session 迟到的初始化失败不会清理新 Session 的页面", async () => {
    const ready = Promise.withResolvers<void>();
    runtime.sessionReady = ready.promise;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    WebBrowser.close();
    runtime.sessionReady = undefined;
    const page = await WebBrowser.navigate("https://example.com/a");
    ready.reject(new Error("late failure"));
    await Promise.resolve();
    await expect(WebBrowser.execute_script("1+2", page.pageId)).resolves.toBe(3);
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    WebBrowser.close();
  });

  it("内容等待共享整个操作的截止时间，导航耗时不会额外增加完整超时", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const contents = views[0].webContents;
    const navigationStarted = Promise.withResolvers<void>();
    const probeStarted = Promise.withResolvers<void>();
    contents.loadURL.mockImplementationOnce(() => {
      navigationStarted.resolve();
      return new Promise(() => {});
    });
    contents.executeJavaScriptInIsolatedWorld.mockImplementationOnce(() => {
      probeStarted.resolve();
      return new Promise(() => {});
    });
    const pending = WebBrowser.open("https://example.com/a");
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await navigationStarted.promise;
    await vi.advanceTimersByTimeAsync(19_500);
    contents.emit("dom-ready");
    await probeStarted.promise;
    await vi.advanceTimersByTimeAsync(499);
    expect(contents.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(contents.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("缓存总预算按 JSON 转义后的成本淘汰，游标只覆盖保留正文", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const execute = views[0].webContents.executeJavaScript;
    execute.mockResolvedValue({ ...pageData, content: "\u0000".repeat(120_000) });
    const first = await WebBrowser.read_page({
      page_id: page.pageId,
      format: "text",
      max_chars: 500
    });
    expect(first.sourceTruncated).toBe(true);
    expect(first.contentRange.totalChars).toBeLessThan(120_000);
    await WebBrowser.read_page({ page_id: page.pageId, format: "markdown", max_chars: 500 });
    await expect(
      WebBrowser.read_page({
        page_id: page.pageId,
        format: "text",
        cursor: first.contentRange.nextCursor!
      })
    ).rejects.toMatchObject({ code: "cache_expired" });
    WebBrowser.close();
  });

  it("首次执行脚本前加载空白页，后续执行保留当前页面", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    expect(await WebBrowser.execute_script("1+2")).toBe(3);
    expect(views[0].webContents.loadURL).toHaveBeenCalledWith("about:blank");
    await WebBrowser.execute_script("document.title");
    expect(views[0].webContents.loadURL).toHaveBeenCalledOnce();
    expect(views[0].webContents.listenerCount("destroyed")).toBe(1);
  });

  it("页面和宿主使用专用 Session，代理就绪前不执行导航或脚本", async () => {
    const ready = Promise.withResolvers<void>();
    runtime.sessionReady = ready.promise;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const navigation = WebBrowser.navigate("https://example.com/a");
    const script = WebBrowser.execute_script("1+2");
    await Promise.resolve();

    expect(views[0].options.webPreferences.session).toBe(browserSessions[0].session);
    expect(windows[0].options.webPreferences.session).toBe(browserSessions[0].session);
    expect(views[0].options.webPreferences).toMatchObject({
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    });
    expect(views[0].webContents.loadURL).not.toHaveBeenCalled();
    expect(views[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    ready.resolve();
    await navigation;
    await expect(script).resolves.toBe(3);
    WebBrowser.close();
    expect(browserSessions[0].close).toHaveBeenCalledOnce();
  });

  it("代理初始化失败会关闭页面并拒绝操作，不退回默认 Session", async () => {
    const ready = Promise.withResolvers<void>();
    runtime.sessionReady = ready.promise;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const pending = WebBrowser.navigate("https://example.com/a");
    const assertion = expect(pending).rejects.toThrow("proxy setup failed");
    ready.reject(new Error("proxy setup failed"));
    await assertion;
    expect(views[0].webContents.loadURL).not.toHaveBeenCalled();
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(browserSessions[0].close).toHaveBeenCalledOnce();
  });

  it.each([
    "http://127.0.0.1:8829/",
    "https://localhost:8830/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/",
    "http://[::ffff:127.0.0.1]/"
  ])("显式入口拒绝本地、私网及元数据地址 %s", async (url) => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    await expect(WebBrowser.read_page({ url })).rejects.toThrow("不允许访问");
    expect(views).toHaveLength(0);
  });

  it("开发模式显示窗口并自动打开页面的 DevTools", async () => {
    runtime.isDev = true;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    await WebBrowser.navigate("https://example.com/");
    expect(windows[0].options.show).toBe(true);
    expect(views[0].webContents.openDevTools).toHaveBeenCalledOnce();
  });

  it("非开发模式保持窗口隐藏且不自动打开 DevTools", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    await WebBrowser.navigate("https://example.com/");
    expect(windows[0].options.show).toBe(false);
    expect(views[0].webContents.openDevTools).not.toHaveBeenCalled();
  });

  it("脚本挂起时关闭页面，最后一页关闭后销毁窗口且后续可恢复", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    await WebBrowser.navigate("https://example.com/");
    views[0].webContents.executeJavaScript.mockImplementation(() => new Promise(() => {}));
    const assertion = expect(WebBrowser.execute_script("new Promise(() => {})")).rejects.toThrow(
      "超时"
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(windows[0].destroy).toHaveBeenCalledOnce();
    await WebBrowser.navigate("https://example.com/");
    expect(windows).toHaveLength(2);
  });

  it("导航失败时向调用者返回错误", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    views[0].webContents.loadURL.mockRejectedValueOnce(new Error("ERR_NAME_NOT_RESOLVED"));
    await expect(WebBrowser.navigate("https://example.com/")).rejects.toThrow(
      "ERR_NAME_NOT_RESOLVED"
    );
  });

  it("DOM 已就绪时无需等待挂起的子资源", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const loading = Promise.withResolvers<void>();
    views[0].webContents.loadURL.mockImplementation(() => {
      loading.resolve();
      return new Promise(() => {});
    });
    const pending = WebBrowser.navigate("https://example.com/");
    await loading.promise;
    views[0].webContents.emit("dom-ready");
    await expect(pending).resolves.toMatchObject({ pageId: "page-1" });
    expect(views[0].webContents.stop).not.toHaveBeenCalled();
  });

  it("一个窗口内独立读取多个页面，分页使用缓存且拒绝失效游标", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    views[0].webContents.executeJavaScript.mockResolvedValue(pageData);
    const first = await WebBrowser.read_page({ max_chars: 3 });
    expect(first.content).toBe("abc");
    expect(first.contentRange.nextCursor).toBe(3);
    const other = await WebBrowser.navigate("https://example.com/b");
    expect(other.pageId).toBe(first.pageId);
    await expect(WebBrowser.read_page({ page_id: first.pageId, cursor: 3 })).rejects.toThrow(
      "缓存已失效"
    );
    const restarted = await WebBrowser.read_page({ page_id: first.pageId, max_chars: 3 });
    const pendingB = WebBrowser.read_page({ url: "https://example.com/b" });
    views[1].webContents.executeJavaScript.mockResolvedValue({ ...pageData, title: "B" });
    const pageB = await pendingB;
    expect(pageB.pageId).not.toBe(first.pageId);
    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(2);
    const calls = views[0].webContents.executeJavaScript.mock.calls.length;
    const next = await WebBrowser.read_page({ page_id: restarted.pageId, cursor: 3, max_chars: 3 });
    expect(next.content).toBe("def");
    expect(next.contentRange.hasMore).toBe(true);
    expect(views[0].webContents.executeJavaScript.mock.calls.length).toBe(calls);
    expect(windows[0].contentView.addChildView).toHaveBeenLastCalledWith(views[0]);
    expect(views[1].webContents.close).not.toHaveBeenCalled();
  });

  it("正文含 loading... 时仍可按返回游标完整续读，警告不影响缓存", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const content = "文章中的 loading... 示例。" + "正文".repeat(1_000);
    const execute = views[0].webContents.executeJavaScript;
    execute.mockResolvedValue({ ...pageData, content });

    let page = await WebBrowser.read_page({ max_chars: 500 });
    expect(page.warnings).toHaveLength(1);
    expect(page.contentRange.nextCursor).toBe(500);
    let restored = page.content;
    while (page.contentRange.hasMore) {
      page = await WebBrowser.read_page({
        page_id: page.pageId,
        cursor: page.contentRange.nextCursor!,
        max_chars: 500
      });
      restored += page.content;
    }

    expect(restored).toBe(content);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("提取完成时取消刷新，不会覆盖旧游标正在使用的正文缓存", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const execute = views[0].webContents.executeJavaScript;
    execute.mockResolvedValueOnce({ ...pageData, content: "old ".repeat(300) });
    const first = await WebBrowser.read_page({ max_chars: 500 });
    execute.mockResolvedValueOnce({ ...pageData, content: "new ".repeat(300) });
    const controller = new AbortController();
    const remove = controller.signal.removeEventListener.bind(controller.signal);
    // 在底层提取结束、上层尚未接收结果时取消。
    vi.spyOn(controller.signal, "removeEventListener").mockImplementation((...args) => {
      remove(...args);
      if (execute.mock.calls.length >= 2 && !controller.signal.aborted) controller.abort();
    });

    await expect(
      WebBrowser.read_page({ page_id: first.pageId, max_chars: 500 }, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    const next = await WebBrowser.read_page({
      page_id: first.pageId,
      cursor: first.contentRange.nextCursor!,
      max_chars: 500
    });

    expect(next.content).toBe("old ".repeat(300).slice(500, 1_000));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("读取 snapshot 保留正文续读缓存，execute_js 修改页面后使其失效", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const execute = views[0].webContents.executeJavaScript;
    execute.mockResolvedValueOnce(pageData);
    const first = await WebBrowser.read_page({ page_id: page.pageId, max_chars: 3 });
    execute.mockResolvedValueOnce({
      url: pageData.url,
      title: pageData.title,
      snapshot: "<body>页面快照</body>",
      sourceTruncated: false
    });

    expect(await WebBrowser.snapshot(page.pageId)).toMatchObject({ pageId: page.pageId });
    const calls = execute.mock.calls.length;
    const next = await WebBrowser.read_page({
      page_id: page.pageId,
      cursor: first.contentRange.nextCursor!,
      max_chars: 3
    });
    expect(next.content).toBe("def");
    expect(execute).toHaveBeenCalledTimes(calls);

    await WebBrowser.execute_script("document.body.textContent = 'changed'", page.pageId);
    await expect(WebBrowser.read_page({ page_id: page.pageId, cursor: 3 })).rejects.toThrow(
      "缓存已失效"
    );
  });

  it("正文缓存区分 links 和 images 请求，改变提取选项必须重新开始读取", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const execute = views[0].webContents.executeJavaScript;
    execute.mockResolvedValueOnce(pageData);
    await WebBrowser.read_page({ page_id: page.pageId, max_chars: 3 });
    const variants = [
      {
        options: { include_links: true },
        data: { links: [{ text: "来源", url: "https://example.com/source" }] }
      },
      {
        options: { include_images: true },
        data: {
          images: [
            {
              url: "https://example.com/photo.jpg",
              width: 400,
              height: 600,
              alt: "照片",
              context: "说明"
            }
          ]
        }
      }
    ];
    for (const variant of variants) {
      const calls = execute.mock.calls.length;
      await expect(
        WebBrowser.read_page({ page_id: page.pageId, cursor: 3, ...variant.options })
      ).rejects.toThrow("缓存已失效");
      expect(execute).toHaveBeenCalledTimes(calls);
      execute.mockResolvedValueOnce({ ...pageData, ...variant.data });
      const first = await WebBrowser.read_page({
        page_id: page.pageId,
        max_chars: 3,
        ...variant.options
      });
      expect(first).toMatchObject(variant.data);
      const next = await WebBrowser.read_page({
        page_id: page.pageId,
        cursor: 3,
        max_chars: 3,
        ...variant.options
      });
      expect(next).toMatchObject({ content: "def", ...variant.data });
      expect(execute).toHaveBeenCalledTimes(calls + 1);
    }
  });

  it("get_images 只请求图片提取，不请求正文或链接", async () => {
    const extractor = await import("@mahiru/app/lib/web-page-extractor");
    const extractionScript = vi.spyOn(extractor, "createWebPageExtractionScript");
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const image = {
      url: "https://example.com/photo.jpg",
      width: 400,
      height: 600,
      alt: "照片",
      context: "说明"
    };
    views[0].webContents.executeJavaScript.mockResolvedValueOnce({
      ...pageData,
      content: "",
      images: [image]
    });

    const result = await WebBrowser.get_images({ page_id: page.pageId, selector: "figure" });

    expect(extractionScript).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        selector: "figure",
        include_content: false,
        include_links: false,
        include_images: true
      })
    );
    expect(result).toMatchObject({ pageId: page.pageId, images: [image], total: 1 });
    expect(views[0].webContents.executeJavaScript).toHaveBeenCalledOnce();
  });

  it("不同 pageId 并发，默认当前页在调用时固定并与该页前序操作串行", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const { AgentToolWebExecute } = await import("@mahiru/app/inner/agent/tools/inner");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "second page" });
    const started = Promise.withResolvers<void>();
    const released = Promise.withResolvers<number>();
    const executeA = views[0].webContents.executeJavaScript;
    executeA.mockImplementationOnce(() => {
      started.resolve();
      return released.promise;
    });
    const active = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "active A",
        page_id: first.pageId
      })
    );
    await started.promise;
    const samePage = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({ action: "execute_js", js: "queued A" })
    );
    const otherPage = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "B",
        page_id: second.pageId
      })
    );

    await expect(otherPage).resolves.toBe(3);
    expect(executeA).toHaveBeenCalledExactlyOnceWith("active A");
    released.resolve(7);
    await expect(active).resolves.toBe(7);
    await expect(samePage).resolves.toBe(3);
    expect(executeA.mock.calls.map(([js]: [string]) => js)).toEqual(["active A", "queued A"]);
  });

  it("一页挂起不阻塞另一页或 close_page，关闭会取消该页的挂起与排队任务", async () => {
    const { AgentToolWebSnapshot } = await import("@mahiru/app/inner/agent/tools/inner");
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const { AgentToolWebExecute } = await import("@mahiru/app/inner/agent/tools/inner");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "second page" });
    const started = Promise.withResolvers<void>();
    views[0].webContents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const active = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "pending",
        page_id: first.pageId
      })
    );
    await started.promise;
    const queued = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "queued",
        page_id: first.pageId
      })
    );
    const activeAssertion = expect(active).rejects.toMatchObject({ code: "aborted" });
    const queuedAssertion = expect(queued).rejects.toMatchObject({ code: "aborted" });

    await expect(
      AgentToolWebExecute.execute(
        AgentToolWebExecute.inputSchema.parse({
          action: "execute_js",
          js: "B",
          page_id: second.pageId
        })
      )
    ).resolves.toBe(3);
    await expect(
      AgentToolWebSnapshot.execute(
        AgentToolWebSnapshot.inputSchema.parse({ action: "close_page", page_id: first.pageId })
      )
    ).resolves.toEqual({ pageId: first.pageId, closed: true });
    await Promise.all([activeAssertion, queuedAssertion]);
    expect(views[0].webContents.executeJavaScript).toHaveBeenCalledOnce();
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    expect(windows[0].destroy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("已取消的请求不会创建浏览器资源", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const controller = new AbortController();
    controller.abort(new Error("custom reason"));

    await expect(
      WebBrowser.read_page({ url: "https://example.com/a" }, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(windows).toHaveLength(0);
    expect(views).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["navigate", "execute_js"])(
    "排队的 %s 取消后立即结束且不执行，也不打断前序或后续任务",
    async (action) => {
      const { WebBrowser } = await import("@mahiru/app/lib/web-search");
      const page = await WebBrowser.navigate("https://example.com/a");
      const contents = views[0].webContents;
      const started = Promise.withResolvers<void>();
      const released = Promise.withResolvers<number>();
      contents.executeJavaScript.mockImplementationOnce(() => {
        started.resolve();
        return released.promise;
      });
      const active = WebBrowser.execute_script("active", page.pageId);
      await started.promise;
      const controller = new AbortController();
      const queued =
        action === "navigate"
          ? WebBrowser.navigate("https://example.com/cancelled", page.pageId, controller.signal)
          : WebBrowser.execute_script("cancelled", page.pageId, controller.signal);
      const assertion = expect(queued).rejects.toMatchObject({ name: "AbortError" });
      const after = WebBrowser.execute_script("after cancel", page.pageId);

      controller.abort(new Error("custom reason"));
      await assertion;
      expect(contents.close).not.toHaveBeenCalled();
      expect(contents.executeJavaScript).toHaveBeenCalledExactlyOnceWith("active");

      released.resolve(7);
      await expect(active).resolves.toBe(7);
      await expect(after).resolves.toBe(3);
      expect(contents.loadURL).toHaveBeenCalledExactlyOnceWith("https://example.com/a");
      expect(contents.executeJavaScript.mock.calls.map(([js]: [string]) => js)).toEqual([
        "active",
        "after cancel"
      ]);
      WebBrowser.close();
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("取消在途脚本只销毁当前页，并跳过该页后续任务", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "second page" });
    const started = Promise.withResolvers<void>();
    views[0].webContents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const controller = new AbortController();
    const active = WebBrowser.execute_script("pending", first.pageId, controller.signal);
    const activeAssertion = expect(active).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    const queued = WebBrowser.execute_script("queued", first.pageId);
    const queuedAssertion = expect(queued).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();
    await Promise.all([activeAssertion, queuedAssertion]);

    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(views[0].webContents.executeJavaScript).toHaveBeenCalledExactlyOnceWith("pending");
    expect(views[0].webContents.listenerCount("destroyed")).toBe(0);
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    expect(windows[0].destroy).not.toHaveBeenCalled();
    expect(await WebBrowser.execute_script("1+2", second.pageId)).toBe(3);
    expect(vi.getTimerCount()).toBe(1);
    WebBrowser.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("导航取消后清理页面监听与超时，不继续执行 open 的快照", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const contents = views[0].webContents;
    const started = Promise.withResolvers<void>();
    contents.loadURL.mockImplementationOnce(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const controller = new AbortController();
    const pending = WebBrowser.open("https://example.com/a", undefined, controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    contents.emit("dom-ready");

    controller.abort();
    await assertion;

    expect(contents.close).toHaveBeenCalledOnce();
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
    expect(contents.listenerCount("dom-ready")).toBe(0);
    expect(contents.listenerCount("destroyed")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("空白页加载中取消后，迟到的加载完成不会启动脚本", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const contents = views[0].webContents;
    const started = Promise.withResolvers<void>();
    const loaded = Promise.withResolvers<void>();
    contents.loadURL.mockImplementationOnce(() => {
      started.resolve();
      return loaded.promise;
    });
    const controller = new AbortController();
    const pending = WebBrowser.execute_script("1+2", undefined, controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;

    controller.abort();
    await assertion;
    loaded.resolve();
    await loaded.promise;
    await Promise.resolve();

    expect(contents.executeJavaScript).not.toHaveBeenCalled();
    expect(contents.listenerCount("destroyed")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(views).toHaveLength(1);
  });

  it("open 原子执行导航和快照，切换其他页不会串页，同页后续任务排在快照之后", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const started = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const contentsA = views[0].webContents;
    contentsA.loadURL.mockImplementationOnce(async (url: string) => {
      started.resolve();
      await released.promise;
      contentsA.url = url;
    });
    contentsA.executeJavaScript.mockImplementation((js: string) =>
      Promise.resolve(
        js === "after open"
          ? 3
          : {
              url: "https://example.com/a",
              title: "A",
              snapshot: "<body>A</body>",
              sourceTruncated: false
            }
      )
    );
    const opening = WebBrowser.open("https://example.com/a");
    await started.promise;
    const afterOpen = WebBrowser.execute_script("after open", "page-1");
    const other = await WebBrowser.search({ query: "B" });
    expect(other.pageId).not.toBe("page-1");
    expect(contentsA.executeJavaScript).not.toHaveBeenCalled();

    released.resolve();
    await expect(opening).resolves.toMatchObject({
      pageId: "page-1",
      url: "https://example.com/a",
      title: "A",
      snapshot: "<body>A</body>"
    });
    await expect(afterOpen).resolves.toBe(3);
    expect(contentsA.executeJavaScript.mock.calls[0][0]).not.toBe("after open");
    expect(contentsA.executeJavaScript.mock.calls[1][0]).toBe("after open");
    expect(views[1].webContents.executeJavaScript).toHaveBeenCalledOnce();
  });

  it("某一页超时不会关闭共享窗口和其他页面", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "test" });
    views[0].webContents.executeJavaScript.mockImplementation(() => new Promise(() => {}));
    const assertion = expect(WebBrowser.execute_script("pending", first.pageId)).rejects.toThrow(
      "超时"
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(windows[0].destroy).not.toHaveBeenCalled();
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    expect(await WebBrowser.execute_script("1+2", second.pageId)).toBe(3);
    expect(windows).toHaveLength(1);
  });

  it("调整窗口尺寸只更新当前页面，关闭窗口释放全部页面", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const first = await WebBrowser.navigate("https://example.com/a");
    await WebBrowser.search({ query: "test" });
    const firstBoundsCalls = views[0].setBounds.mock.calls.length;
    windows[0].bounds = { x: 100, y: 200, width: 900, height: 700 };
    windows[0].emit("resize");
    expect(views[1].setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 900, height: 700 });
    expect(views[0].setBounds).toHaveBeenCalledTimes(firstBoundsCalls);
    windows[0].destroy();
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(views[1].webContents.close).toHaveBeenCalledOnce();
    await expect(WebBrowser.execute_script("1+2", first.pageId)).rejects.toThrow("已关闭或过期");
    expect(await WebBrowser.execute_script("1+2")).toBe(3);
    expect(windows).toHaveLength(2);
  });

  it("每个页面空闲满一分钟独立过期，最后一页过期时释放窗口", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    await WebBrowser.navigate("https://example.com/a");
    await vi.advanceTimersByTimeAsync(20_000);
    await WebBrowser.search({ query: "second page" });

    await vi.advanceTimersByTimeAsync(39_999);
    expect(views[0].webContents.close).not.toHaveBeenCalled();
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    expect(windows[0].destroy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(views[1].webContents.close).toHaveBeenCalledOnce();
    expect(windows[0].destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("页面活动会从最后一次使用重新计算一分钟空闲时间", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    await vi.advanceTimersByTimeAsync(40_000);
    await WebBrowser.execute_script("document.title", page.pageId);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(views[0].webContents.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(windows[0].destroy).toHaveBeenCalledOnce();
  });

  it("显式关闭会释放全部页面和定时器，重复关闭不会重复销毁", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "second page" });
    expect(vi.getTimerCount()).toBe(2);

    WebBrowser.close();
    WebBrowser.close();

    expect(views).toHaveLength(2);
    for (const view of views) expect(view.webContents.close).toHaveBeenCalledOnce();
    expect(windows[0].destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    for (const page of [first, second]) {
      await expect(WebBrowser.execute_script("1+2", page.pageId)).rejects.toThrow("已关闭或过期");
    }
    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(2);
  });

  it("脚本在 destroyed 事件前因关页被拒绝时，仍返回取消而非网络错误", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const { AgentToolWebExecute } = await import("@mahiru/app/inner/agent/tools/inner");
    const page = await WebBrowser.navigate("https://example.com/a");
    const contents = views[0].webContents;
    const started = Promise.withResolvers<void>();
    const script = Promise.withResolvers<never>();
    contents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return script.promise;
    });
    contents.close.mockImplementationOnce(() => {
      script.reject(new Error("Render frame was disposed before the request completed"));
    });
    const pending = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "pending",
        page_id: page.pageId
      })
    );
    const assertion = expect(pending).rejects.toMatchObject({ code: "aborted" });
    await started.promise;
    WebBrowser.close_page(page.pageId);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    expect(contents.listenerCount("destroyed")).toBe(1);
    contents.destroyed = true;
    contents.emit("destroyed");
    expect(contents.listenerCount("destroyed")).toBe(0);
  });

  it("关闭会立即拒绝挂起脚本并清理操作超时，脚本迟到完成也不会恢复资源", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const deferred = Promise.withResolvers<number>();
    const started = Promise.withResolvers<void>();
    views[0].webContents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return deferred.promise;
    });
    const pending = WebBrowser.execute_script("pending", page.pageId);
    const assertion = expect(pending).rejects.toThrow(/关闭|取消|失效/);
    await started.promise;
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    WebBrowser.close();
    await assertion;

    expect(vi.getTimerCount()).toBe(0);
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    expect(windows[0].destroy).toHaveBeenCalledOnce();
    expect(views[0].webContents.listenerCount("destroyed")).toBe(0);
    deferred.resolve(3);
    await pending.catch(() => undefined);
    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("关闭后迟到的空白页加载不会继续执行脚本或留下超时", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    WebBrowser.win;
    const loaded = Promise.withResolvers<void>();
    const loading = Promise.withResolvers<void>();
    views[0].webContents.loadURL.mockImplementationOnce(() => {
      loading.resolve();
      return loaded.promise;
    });
    const pending = WebBrowser.execute_script("1+2");
    const assertion = expect(pending).rejects.toThrow(/关闭|取消|失效/);
    await loading.promise;

    WebBrowser.close();
    await assertion;
    loaded.resolve();
    await loaded.promise;
    await Promise.resolve();

    expect(views[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(views[0].webContents.listenerCount("destroyed")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(1);
  });

  it("关闭时挂起与排队的工具调用都结束，旧队列不会重新创建浏览器", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const { AgentToolWebExecute } = await import("@mahiru/app/inner/agent/tools/inner");
    const page = await WebBrowser.navigate("https://example.com/a");
    const started = Promise.withResolvers<void>();
    views[0].webContents.executeJavaScript.mockImplementation(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const active = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "pending",
        page_id: page.pageId
      })
    );
    const queued = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({
        action: "execute_js",
        js: "queued",
        page_id: page.pageId
      })
    );
    const activeAssertion = expect(active).rejects.toMatchObject({ code: "aborted" });
    const queuedAssertion = expect(queued).rejects.toMatchObject({ code: "aborted" });
    await started.promise;
    expect(views[0].webContents.executeJavaScript).toHaveBeenCalledOnce();

    WebBrowser.close();
    await Promise.all([activeAssertion, queuedAssertion]);

    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      AgentToolWebExecute.execute(
        AgentToolWebExecute.inputSchema.parse({ action: "execute_js", js: "1+2" })
      )
    ).resolves.toBe(3);
    expect(windows).toHaveLength(2);
    expect(views).toHaveLength(2);
  });

  it("固定快照和提取使用隔离世界，自定义脚本保留主世界能力", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const page = await WebBrowser.navigate("https://example.com/a");
    const contents = views[0].webContents;
    const outputs = [
      { url: "https://example.com/a", title: "A", snapshot: "", sourceTruncated: false },
      pageData
    ];
    contents.executeJavaScriptInIsolatedWorld.mockImplementation(
      (_world: number, scripts: Array<{ code: string }>) =>
        Promise.resolve(
          scripts[0]!.code.startsWith("/*aira-content-ready*/") ? { ready: true } : outputs.shift()
        )
    );
    await WebBrowser.snapshot(page.pageId);
    await WebBrowser.read_page({ page_id: page.pageId });
    expect(contents.executeJavaScriptInIsolatedWorld).toHaveBeenCalledTimes(4);
    expect(contents.executeJavaScriptInIsolatedWorld.mock.calls[0][0]).toBe(999);
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
    await WebBrowser.execute_script("document.title", page.pageId);
    expect(contents.executeJavaScript).toHaveBeenCalledExactlyOnceWith("document.title");
  });

  it("容量满时保留在用页，并淘汰最近最少使用的空闲页", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const pages = [];
    for (let i = 0; i < 6; i++) pages.push(await WebBrowser.search({ query: String(i) }));
    await WebBrowser.execute_script("touch", pages[0]!.pageId);
    const started = Promise.withResolvers<void>();
    const result = Promise.withResolvers<number>();
    views[1].webContents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return result.promise;
    });
    const active = WebBrowser.execute_script("pending", pages[1]!.pageId);
    await started.promise;
    await WebBrowser.search({ query: "seventh" });
    expect(views[0].webContents.close).not.toHaveBeenCalled();
    expect(views[1].webContents.close).not.toHaveBeenCalled();
    expect(views[2].webContents.close).toHaveBeenCalledOnce();
    result.resolve(3);
    await active;
    WebBrowser.close();
  });

  it("所有页面均有排队任务时返回 busy，不淘汰页面或创建额外资源", async () => {
    const ready = Promise.withResolvers<void>();
    runtime.sessionReady = ready.promise;
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const pending = Array.from({ length: 6 }, (_, i) => WebBrowser.search({ query: String(i) }));
    await expect(WebBrowser.search({ query: "seventh" })).rejects.toMatchObject({ code: "busy" });
    expect(views).toHaveLength(6);
    for (const view of views) expect(view.webContents.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    ready.resolve();
    await Promise.all(pending);
    WebBrowser.close();
  });

  it("渲染进程崩溃立即取消当前页和排队任务，其他页面继续工作", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const first = await WebBrowser.navigate("https://example.com/a");
    const second = await WebBrowser.search({ query: "second" });
    const started = Promise.withResolvers<void>();
    views[0].webContents.executeJavaScript.mockImplementationOnce(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const active = WebBrowser.execute_script("pending", first.pageId);
    const queued = WebBrowser.execute_script("queued", first.pageId);
    const assertions = [active, queued].map((request) =>
      expect(request).rejects.toMatchObject({ name: "AbortError" })
    );
    await started.promise;
    views[0].webContents.emit("render-process-gone", {}, { reason: "crashed" });
    await Promise.all(assertions);
    expect(views[0].webContents.close).toHaveBeenCalledOnce();
    await expect(WebBrowser.execute_script("1+2", second.pageId)).resolves.toBe(3);
    WebBrowser.close();
  });

  it("页面调用入队后立即关闭，任务不会开始执行或重新创建资源", async () => {
    const { WebBrowser } = await import("@mahiru/app/lib/web-search");
    const { AgentToolWebExecute } = await import("@mahiru/app/inner/agent/tools/inner");
    const scheduled = AgentToolWebExecute.execute(
      AgentToolWebExecute.inputSchema.parse({ action: "execute_js", js: "1+2" })
    );
    const assertion = expect(scheduled).rejects.toThrow(/关闭|取消|失效/);

    WebBrowser.close();
    await assertion;

    expect(windows).toHaveLength(1);
    expect(views).toHaveLength(1);
    expect(views[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
