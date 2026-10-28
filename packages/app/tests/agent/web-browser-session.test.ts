import { EventEmitter } from "node:events";
import { WebBrowserSession } from "@mahiru/app/lib/web-browser-session";

const mocks = vi.hoisted(() => ({
  sessions: [] as any[],
  fromPartition: vi.fn(),
  proxy: vi.fn(),
  lookup: vi.fn(),
  closeProxy: vi.fn(),
  networkInterfaces: vi.fn()
}));
vi.mock("electron", () => ({ session: { fromPartition: mocks.fromPartition } }));
vi.mock("@/lib/web-safe-proxy", () => ({ createPublicWebProxy: mocks.proxy }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:os", () => ({ networkInterfaces: mocks.networkInterfaces }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessions.length = 0;
  mocks.closeProxy.mockResolvedValue(undefined);
  mocks.proxy.mockResolvedValue({ url: "http://127.0.0.1:32100", close: mocks.closeProxy });
  mocks.lookup.mockResolvedValue([{ family: 4, address: "93.184.216.34" }]);
  mocks.networkInterfaces.mockReturnValue({});
  mocks.fromPartition.mockImplementation(() => {
    const ses = Object.assign(new EventEmitter(), {
      setProxy: vi.fn().mockResolvedValue(undefined),
      closeAllConnections: vi.fn().mockResolvedValue(undefined),
      clearStorageData: vi.fn().mockResolvedValue(undefined),
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() }
    });
    mocks.sessions.push(ses);
    return ses;
  });
});

afterEach(() => vi.useRealTimers());

async function request(runtime: WebBrowserSession, url: string) {
  const handler = mocks.sessions.find((ses) => ses === runtime.session).webRequest.onBeforeRequest
    .mock.calls[0][1];
  return new Promise<{ cancel?: boolean }>((resolve) => handler({ url } as never, resolve));
}

describe("网页工具独立会话", () => {
  it("使用不同的非持久分区，并配置固定代理且取消隐式回环绕过", async () => {
    const first = new WebBrowserSession();
    const second = new WebBrowserSession();
    await Promise.all([first.ready, second.ready]);
    const partitions = mocks.fromPartition.mock.calls.map(([partition]) => partition);
    expect(new Set(partitions).size).toBe(2);
    for (const partition of partitions) {
      expect(partition).toMatch(/^aira-agent-web-/);
      expect(partition).not.toMatch(/^persist:/);
    }
    expect(mocks.fromPartition).toHaveBeenCalledWith(expect.any(String), { cache: false });
    expect(first.session.setProxy).toHaveBeenCalledWith({
      mode: "fixed_servers",
      proxyRules: "http://127.0.0.1:32100",
      proxyBypassRules: "<-loopback>"
    });
    await Promise.all([first.close(), second.close()]);
  });

  it("顶层、重定向后续请求和页面子请求使用同一公网校验", async () => {
    const runtime = new WebBrowserSession();
    await runtime.ready;
    expect(await request(runtime, "https://example.com/start")).toEqual({ cancel: false });
    for (const url of [
      "https://localhost:8830/",
      "http://127.0.0.1:8829/",
      "http://192.168.1.2/",
      "http://169.254.169.254/latest/",
      "http://[::1]/",
      "file:///tmp/test",
      "ws://example.com/"
    ])
      expect(await request(runtime, url)).toEqual({ cancel: true });
    mocks.lookup.mockResolvedValue([{ family: 4, address: "10.0.0.1" }]);
    expect(await request(runtime, "https://redirect.example/next")).toEqual({ cancel: true });
    expect(await request(runtime, "about:blank")).toEqual({ cancel: false });
    await runtime.close();
  });

  it("同一 host 的并发子请求共享 DNS 预检，并跨路径、端口复用短缓存", async () => {
    const lookup = Promise.withResolvers<Array<{ family: number; address: string }>>();
    mocks.lookup.mockReturnValueOnce(lookup.promise);
    const runtime = new WebBrowserSession();
    await runtime.ready;
    const first = request(runtime, "https://assets.example/one.js");
    const second = request(runtime, "http://assets.example:8080/two.css");
    expect(mocks.lookup).toHaveBeenCalledOnce();
    lookup.resolve([{ family: 4, address: "93.184.216.34" }]);
    expect(await Promise.all([first, second])).toEqual([{ cancel: false }, { cancel: false }]);
    expect(await request(runtime, "https://assets.example/three.png")).toEqual({ cancel: false });
    expect(mocks.lookup).toHaveBeenCalledOnce();
    expect(mocks.networkInterfaces).toHaveBeenCalledOnce();
    // 凭据与协议必须逐 URL 校验，不能借同 host 的缓存绕过。
    expect(await request(runtime, "https://user:password@assets.example/private")).toEqual({
      cancel: true
    });
    expect(await request(runtime, "ws://assets.example/socket")).toEqual({ cancel: true });
    await runtime.close();
    expect(await request(runtime, "https://assets.example/after-close")).toEqual({ cancel: true });
    expect(mocks.lookup).toHaveBeenCalledOnce();
  });

  it("预检缓存三十秒过期，且不同 Session 不共享放行结果", async () => {
    vi.useFakeTimers();
    const first = new WebBrowserSession();
    await first.ready;
    expect(await request(first, "https://cache.example/start")).toEqual({ cancel: false });
    mocks.lookup.mockResolvedValue([{ family: 4, address: "127.0.0.1" }]);
    expect(await request(first, "https://cache.example/cached")).toEqual({ cancel: false });
    const second = new WebBrowserSession();
    await second.ready;
    expect(await request(second, "https://cache.example/new-session")).toEqual({ cancel: true });
    vi.setSystemTime(Date.now() + 30_000);
    expect(await request(first, "https://cache.example/expired")).toEqual({ cancel: true });
    expect(mocks.lookup).toHaveBeenCalledTimes(3);
    await Promise.all([first.close(), second.close()]);
  });

  it("临时 DNS 失败仅缓存一秒，恢复后可重新校验", async () => {
    vi.useFakeTimers();
    mocks.lookup.mockRejectedValueOnce(new Error("EAI_AGAIN"));
    const runtime = new WebBrowserSession();
    await runtime.ready;
    expect(await request(runtime, "https://retry.example/one")).toEqual({ cancel: true });
    expect(await request(runtime, "https://retry.example/two")).toEqual({ cancel: true });
    vi.setSystemTime(Date.now() + 1_000);
    expect(await request(runtime, "https://retry.example/three")).toEqual({ cancel: false });
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    await runtime.close();
  });

  it("host 预检缓存有界，容量满时淘汰最近最少使用的结果", async () => {
    const runtime = new WebBrowserSession();
    await runtime.ready;
    for (let i = 0; i < 128; i++) await request(runtime, `https://host${i}.example/`);
    await request(runtime, "https://host0.example/touch");
    await request(runtime, "https://extra.example/");
    expect(mocks.lookup).toHaveBeenCalledTimes(129);
    await request(runtime, "https://host0.example/still-cached");
    expect(mocks.lookup).toHaveBeenCalledTimes(129);
    await request(runtime, "https://host1.example/evicted");
    expect(mocks.lookup).toHaveBeenCalledTimes(130);
    await runtime.close();
  });

  it("拒绝全部权限和下载", async () => {
    const runtime = new WebBrowserSession();
    await runtime.ready;
    const ses = mocks.sessions[0];
    expect(ses.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false);
    const callback = vi.fn();
    ses.setPermissionRequestHandler.mock.calls[0][0]({}, "media", callback);
    expect(callback).toHaveBeenCalledWith(false);
    const event = { preventDefault: vi.fn() };
    ses.emit("will-download", event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    await runtime.close();
  });

  it("关闭等待初始化完成，并清理代理、存储和连接，后续请求拒绝", async () => {
    const proxy = Promise.withResolvers<{ url: string; close: typeof mocks.closeProxy }>();
    mocks.proxy.mockReturnValueOnce(proxy.promise);
    const runtime = new WebBrowserSession();
    const closed = runtime.close();
    expect(runtime.close()).toBe(closed);
    expect(mocks.closeProxy).not.toHaveBeenCalled();
    proxy.resolve({ url: "http://127.0.0.1:32100", close: mocks.closeProxy });
    await closed;
    expect(runtime.session.closeAllConnections).toHaveBeenCalledOnce();
    expect(runtime.session.clearStorageData).toHaveBeenCalledOnce();
    expect(mocks.closeProxy).toHaveBeenCalledOnce();
    expect(await request(runtime, "https://example.com/")).toEqual({ cancel: true });
  });

  it("代理配置失败时释放代理并传递启动错误", async () => {
    const runtime = new WebBrowserSession();
    vi.mocked(runtime.session.setProxy).mockRejectedValueOnce(new Error("setProxy failed"));
    await expect(runtime.ready).rejects.toThrow("setProxy failed");
    expect(mocks.closeProxy).toHaveBeenCalledOnce();
    await runtime.close();
  });

  it("拒绝弹窗、不经代理的 WebRTC、私网跳转及非 HTTP iframe 导航", () => {
    const contents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
      setWebRTCIPHandlingPolicy: vi.fn(),
      setWindowOpenHandler: vi.fn()
    });
    WebBrowserSession.protectWebContents(contents as never);
    expect(contents.setWebRTCIPHandlingPolicy).toHaveBeenCalledWith("disable_non_proxied_udp");
    expect(contents.setWindowOpenHandler.mock.calls[0]![0]()).toEqual({ action: "deny" });
    for (const url of [
      "https://localhost:8830/",
      "http://192.168.1.1/",
      "file:///tmp/test",
      "data:text/html,hello"
    ]) {
      for (const name of ["will-frame-navigate", "will-redirect"]) {
        const event = { url, preventDefault: vi.fn() };
        contents.emit(name, event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
      }
    }
    const event = { url: "https://example.com/", preventDefault: vi.fn() };
    contents.emit("will-frame-navigate", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
