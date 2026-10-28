import { type Socket, type AddressInfo, connect as createSocket } from "node:net";
import {
  createServer,
  type ServerResponse,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  request as createHTTPRequest
} from "node:http";

import { resolvePublicWebHostname } from "./web-url-safety";

const ProxyHost = "127.0.0.1";
const ProxyTimeoutMs = 20_000;

/** 每次转发重新验证 DNS，并仅连接本次验证后的 IP，Chromium 不直接解析目标。 */
export async function createPublicWebProxy(): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const sockets = new Set<Socket>();
  let closing: undefined | Promise<void>;
  const track = (socket: Socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  };
  const server = createServer((request, response) => {
    void proxyHTTP(request, response);
  });
  server.on("connection", track);
  server.on("connect", (request, socket, head) => {
    void proxyConnect(request, socket as Socket, head);
  });
  server.on("upgrade", (_request, socket) => socket.destroy());
  server.on("clientError", (_error, socket) => socket.destroy());

  async function endpoint(hostname: string) {
    const addresses = await resolvePublicWebHostname(hostname);
    if (closing) throw new Error("网页代理已关闭");
    const address = addresses.find((item) => item.family === 4) ?? addresses[0];
    if (!address) throw new Error("目标不是可安全解析的公网地址");
    return address;
  }

  async function proxyHTTP(request: IncomingMessage, response: ServerResponse) {
    try {
      const target = new URL(request.url ?? "");
      if (target.protocol !== "http:" || target.username || target.password || target.hash)
        throw new Error("代理只允许无认证信息的 HTTP URL");
      const port = Number(target.port || 80);
      if (port < 1 || port > 65_535) throw new Error("目标端口无效");
      const address = await endpoint(target.hostname);
      if (request.destroyed || response.destroyed) return;
      const headers: OutgoingHttpHeaders = { ...request.headers, host: target.host };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      delete headers["connection"];
      delete headers["upgrade"];
      const upstream = createHTTPRequest({
        agent: false,
        hostname: address.address,
        family: address.family,
        port,
        method: request.method,
        path: `${target.pathname}${target.search}`,
        headers
      });
      upstream.on("socket", track);
      upstream.setTimeout(ProxyTimeoutMs, () => upstream.destroy(new Error("代理连接超时")));
      upstream.on("response", (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.on("error", () => response.destroy());
        incoming.pipe(response);
      });
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      request.once("aborted", () => upstream.destroy());
      response.once("close", () => upstream.destroy());
      request.pipe(upstream);
    } catch {
      if (!response.headersSent) response.writeHead(403);
      response.end("Forbidden");
    }
  }

  async function proxyConnect(request: IncomingMessage, client: Socket, head: Buffer) {
    try {
      const authority = request.url ?? "";
      if (!/^(?:\[[^\]]+\]|[^:/?#@\\\s]+):\d+$/.test(authority))
        throw new Error("CONNECT 需要 host:port");
      const target = new URL(`https://${authority}`);
      const port = Number(target.port || 443);
      if (port < 1 || port > 65_535) throw new Error("目标端口无效");
      const address = await endpoint(target.hostname);
      if (client.destroyed) return;
      const upstream = createSocket({ host: address.address, family: address.family, port });
      track(upstream);
      upstream.setTimeout(ProxyTimeoutMs, () => upstream.destroy(new Error("代理连接超时")));
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.once("error", () => client.destroy());
      upstream.once("close", () => client.destroy());
      client.once("error", () => upstream.destroy());
      client.once("close", () => upstream.destroy());
    } catch {
      if (!client.destroyed) client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, ProxyHost, () => {
      server.off("error", reject);
      resolve();
    });
  });
  server.unref();
  const address = server.address() as AddressInfo;
  return {
    url: `http://${ProxyHost}:${address.port}`,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        for (const socket of sockets) socket.destroy();
        server.close((error) => (error ? reject(error) : resolve()));
      });
      return closing;
    }
  };
}
