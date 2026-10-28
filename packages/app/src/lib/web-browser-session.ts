import { session, type WebContents } from "electron";

import { createPublicWebProxy } from "./web-safe-proxy";
import { parsePublicWebURL, normalizeWebHostname, canRequestPublicWebURL } from "./web-url-safety";

const HostCacheTTL = 30_000;
const HostCacheLimit = 128;

/** 仅网页工具使用，网络策略和站点存储都不接触应用 defaultSession。 */
export class WebBrowserSession {
  readonly session = session.fromPartition(`aira-agent-web-${crypto.randomUUID()}`, {
    cache: false
  });
  readonly ready: Promise<void>;
  private proxy?: Awaited<ReturnType<typeof createPublicWebProxy>>;
  private stopping?: Promise<void>;
  private readonly hosts = new Map<string, { expiresAt: number; allowed: Promise<boolean> }>();

  constructor() {
    const ses = this.session;
    ses.setPermissionCheckHandler(() => false);
    ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    ses.on("will-download", (event) => event.preventDefault());
    ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
      void this.canRequest(details.url).then(
        (allowed) => callback({ cancel: !allowed || Boolean(this.stopping) }),
        () => callback({ cancel: true })
      );
    });
    this.ready = this.initialize();
    // 页面可能在首个操作入队前关闭；初始化失败仍由 ready 传给调用方。
    void this.ready.catch(() => undefined);
  }

  private canRequest(value: string): Promise<boolean> {
    if (this.stopping) return Promise.resolve(false);
    if (value === "about:blank") return Promise.resolve(true);
    let url: URL;
    try {
      url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
        return Promise.resolve(false);
    } catch {
      return Promise.resolve(false);
    }
    const host = normalizeWebHostname(url.hostname);
    const cached = this.hosts.get(host);
    if (cached && cached.expiresAt > Date.now()) {
      this.hosts.delete(host);
      this.hosts.set(host, cached);
      return cached.allowed;
    }
    if (cached) this.hosts.delete(host);
    if (this.hosts.size >= HostCacheLimit) this.hosts.delete(this.hosts.keys().next().value!);
    const entry = {
      expiresAt: Number.POSITIVE_INFINITY,
      allowed: canRequestPublicWebURL(url.href).then((allowed) => {
        // 这里只缓存预检；代理仍在每次实际连接时重新解析并绑定安全 IP。
        entry.expiresAt = Date.now() + (allowed ? HostCacheTTL : 1_000);
        return allowed;
      })
    };
    this.hosts.set(host, entry);
    return entry.allowed;
  }

  private async initialize() {
    const proxy = await createPublicWebProxy();
    this.proxy = proxy;
    try {
      await this.session.setProxy({
        mode: "fixed_servers",
        proxyRules: proxy.url,
        proxyBypassRules: "<-loopback>"
      });
    } catch (error) {
      await proxy.close();
      throw error;
    }
  }

  close(): Promise<void> {
    this.hosts.clear();
    this.stopping ??= this.ready
      .catch(() => undefined)
      .then(async () => {
        await Promise.allSettled([
          this.session.closeAllConnections(),
          this.session.clearStorageData(),
          this.proxy?.close()
        ]);
      });
    return this.stopping;
  }

  static protectWebContents(contents: WebContents) {
    contents.setAudioMuted(true);
    contents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-prevent-unload", (event) => event.preventDefault());
    const guard = (event: Electron.Event, target: string) => {
      if (target === "about:blank") return;
      try {
        parsePublicWebURL(target);
      } catch {
        event.preventDefault();
      }
    };
    contents.on("will-frame-navigate", (details) => guard(details, details.url));
    contents.on("will-redirect", (details) => guard(details, details.url));
  }
}
