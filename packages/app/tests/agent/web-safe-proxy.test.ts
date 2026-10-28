import { PassThrough } from "node:stream";
import { assertPublicWebURL } from "@mahiru/app/lib/web-url-safety";
import { createPublicWebProxy } from "@mahiru/app/lib/web-safe-proxy";

const mocks = vi.hoisted(() => ({
  servers: [] as any[],
  lookup: vi.fn(),
  request: vi.fn(),
  connect: vi.fn(),
  networkInterfaces: vi.fn()
}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:os", () => ({ networkInterfaces: mocks.networkInterfaces }));
vi.mock("node:net", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:net")>()),
  connect: mocks.connect
}));
vi.mock("node:http", async (importOriginal) => {
  const { EventEmitter } = await import("node:events");
  return {
    ...(await importOriginal<typeof import("node:http")>()),
    request: mocks.request,
    createServer: (handler: (...args: any[]) => void) => {
      const server = new EventEmitter() as any;
      server.on("request", handler);
      server.listen = vi.fn((_port, _host, ready) => queueMicrotask(ready));
      server.address = () => ({ port: 12345 });
      server.unref = vi.fn();
      server.close = vi.fn((done) => done());
      mocks.servers.push(server);
      return server;
    }
  };
});

function socket() {
  const value = new PassThrough() as PassThrough & { setTimeout: ReturnType<typeof vi.fn> };
  value.setTimeout = vi.fn().mockReturnValue(value);
  vi.spyOn(value, "destroy");
  vi.spyOn(value, "end");
  return value;
}

function request(url: string) {
  return Object.assign(new PassThrough(), {
    url,
    method: "GET",
    headers: { host: "wrong.example", "proxy-authorization": "secret" }
  });
}

function response() {
  const value = Object.assign(new PassThrough(), {
    headersSent: false,
    statusCode: 200,
    writeHead: vi.fn(function (this: { statusCode: number; headersSent: boolean }, code: number) {
      this.headersSent = true;
      this.statusCode = code;
    })
  });
  vi.spyOn(value, "end");
  return value;
}

const running: Array<Awaited<ReturnType<typeof createPublicWebProxy>>> = [];
async function start() {
  const proxy = await createPublicWebProxy();
  running.push(proxy);
  return { proxy, server: mocks.servers.at(-1)! };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.servers.length = 0;
  mocks.lookup.mockReset().mockResolvedValue([{ family: 4, address: "93.184.216.34" }]);
  mocks.networkInterfaces.mockReset().mockReturnValue({ en0: [{ address: "8.8.4.4" }] });
  mocks.request.mockImplementation(() => socket());
  mocks.connect.mockImplementation(() => socket());
});
afterEach(async () => {
  await Promise.all(running.splice(0).map((proxy) => proxy.close()));
});

describe("公开网页代理", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "8.8.4.4", "[::1]", "[::ffff:127.0.0.1]"])(
    "HTTP 和 CONNECT 均拒绝私网、回环和本机地址 %s",
    async (host) => {
      const { server } = await start();
      const res = response();
      server.emit("request", request(`http://${host}/secret`), res);
      const client = socket();
      server.emit("connect", request(`${host}:443`), client, Buffer.alloc(0));
      await vi.waitFor(() => {
        expect(res.statusCode).toBe(403);
        expect(client.end).toHaveBeenCalledWith(expect.stringContaining("403 Forbidden"));
      });
      expect(mocks.request).not.toHaveBeenCalled();
      expect(mocks.connect).not.toHaveBeenCalled();
    }
  );

  it("HTTP 连接绑定已验证的公网 IP，保留目标 Host 并移除代理认证", async () => {
    const { server } = await start();
    const req = request("http://example.com:8080/page?q=1");
    server.emit("request", req, response());
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "93.184.216.34",
        family: 4,
        port: 8080,
        path: "/page?q=1",
        headers: { host: "example.com:8080" },
        agent: false
      })
    );
    expect(mocks.lookup).toHaveBeenCalledOnce();
    req.end();
  });

  it("CONNECT 连接绑定已验证的公网 IPv6，不再向传输层传域名", async () => {
    mocks.lookup.mockResolvedValue([{ family: 6, address: "2606:4700:4700::1111" }]);
    const { server } = await start();
    server.emit("connect", request("example.com:8443"), socket(), Buffer.alloc(0));
    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
    expect(mocks.connect).toHaveBeenCalledWith({
      host: "2606:4700:4700::1111",
      family: 6,
      port: 8443
    });
    expect(mocks.lookup).toHaveBeenCalledOnce();
  });

  it("域名任何一个 DNS 结果为私网时，不连接其他公网结果", async () => {
    mocks.lookup.mockResolvedValue([
      { family: 4, address: "93.184.216.34" },
      { family: 4, address: "10.0.0.1" }
    ]);
    const { server } = await start();
    const res = response();
    server.emit("request", request("http://mixed.example/"), res);
    await vi.waitFor(() => expect(res.statusCode).toBe(403));
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each(["http", "connect"])("URL 预检之后 DNS 变为私网时，%s 转发再次拒绝", async (mode) => {
    await expect(assertPublicWebURL("https://rebind.example/")).resolves.toBeInstanceOf(URL);
    mocks.lookup.mockResolvedValue([{ family: 4, address: "127.0.0.1" }]);
    const { server } = await start();
    const res = response();
    const client = socket();
    if (mode === "http") server.emit("request", request("http://rebind.example/"), res);
    else server.emit("connect", request("rebind.example:443"), client, Buffer.alloc(0));
    await vi.waitFor(() => {
      if (mode === "http") expect(res.statusCode).toBe(403);
      else expect(client.end).toHaveBeenCalledWith(expect.stringContaining("403 Forbidden"));
    });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });

  it("同 host 的第二次实际连接仍重新校验 DNS，不使用 Session 预检缓存", async () => {
    const { server } = await start();
    server.emit("request", request("http://same-host.example/first"), response());
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    mocks.lookup.mockResolvedValue([{ family: 4, address: "127.0.0.1" }]);
    const second = response();
    server.emit("request", request("http://same-host.example/second"), second);
    await vi.waitFor(() => expect(second.statusCode).toBe(403));
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(mocks.request).toHaveBeenCalledOnce();
  });

  it("公网 302 的后续 HTTP 请求仍要拒绝私网目标", async () => {
    const { server } = await start();
    const first = response();
    server.emit("request", request("http://example.com/start"), first);
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    const upstream = mocks.request.mock.results[0]!.value;
    const redirect = Object.assign(new PassThrough(), {
      statusCode: 302,
      headers: { location: "http://127.0.0.1/admin" }
    });
    upstream.emit("response", redirect);
    redirect.end();
    expect(first.writeHead).toHaveBeenCalledWith(302, redirect.headers);
    const second = response();
    server.emit("request", request(redirect.headers.location), second);
    await vi.waitFor(() => expect(second.statusCode).toBe(403));
    expect(mocks.request).toHaveBeenCalledOnce();
  });

  it.each([
    "user:pass@example.com:443",
    "example.com:443/path",
    "example.com:0",
    "example.com:99999"
  ])("CONNECT 不接受认证信息或畸形地址 %s", async (authority) => {
    const { server } = await start();
    const client = socket();
    server.emit("connect", request(authority), client, Buffer.alloc(0));
    await vi.waitFor(() => expect(client.end).toHaveBeenCalled());
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("关闭会销毁客户端和正在连接的隧道，重复关闭只执行一次", async () => {
    const { proxy, server } = await start();
    const client = socket();
    server.emit("connection", client);
    server.emit("connect", request("example.com:443"), client, Buffer.alloc(0));
    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
    const upstream = mocks.connect.mock.results[0]!.value;
    await Promise.all([proxy.close(), proxy.close()]);
    expect(client.destroy).toHaveBeenCalled();
    expect(upstream.destroy).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalledOnce();
  });

  it("关闭发生于 DNS 解析中时，解析结果不能建立新连接", async () => {
    const pending = Promise.withResolvers<Array<{ family: number; address: string }>>();
    mocks.lookup.mockReturnValue(pending.promise);
    const { proxy, server } = await start();
    const res = response();
    server.emit("request", request("http://example.com/"), res);
    await proxy.close();
    pending.resolve([{ family: 4, address: "93.184.216.34" }]);
    await vi.waitFor(() => expect(res.statusCode).toBe(403));
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
