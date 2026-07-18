import { type Socket, type AddressInfo, connect as createSocket } from "node:net";
import {
  createServer,
  type ServerResponse,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  request as createHTTPRequest
} from "node:http";

import { resolvePublicWebHostname } from "./web-url-safety";

const AgentWebProxyHost = "127.0.0.1";
const AgentWebProxyTimeoutMs = 20_000;

let AgentWebProxyURLPromise: undefined | Promise<string>;

export function getAgentWebSafeProxyURL(): Promise<string> {
  AgentWebProxyURLPromise ??= startAgentWebSafeProxy();
  return AgentWebProxyURLPromise;
}

async function startAgentWebSafeProxy(): Promise<string> {
  const server = createServer((request, response) => {
    void proxyHTTPRequest(request, response);
  });
  server.on("connect", (request, socket, head) => {
    void proxyHTTPSConnect(request, socket as Socket, head);
  });
  server.on("clientError", (_error, socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, AgentWebProxyHost);
  });

  server.unref();
  const address = server.address() as AddressInfo;
  return `http://${AgentWebProxyHost}:${address.port}`;
}

async function proxyHTTPRequest(request: IncomingMessage, response: ServerResponse) {
  try {
    if (!request.url) throw new Error("代理请求缺少目标 URL");
    const target = new URL(request.url);
    if (target.protocol !== "http:" || target.username || target.password) {
      throw new Error("代理仅允许公开 HTTP 请求");
    }
    const port = Number(target.port || 80);
    if (port !== 80) throw new Error("HTTP 代理仅允许标准端口");

    const endpoint = await resolveProxyEndpoint(target.hostname);
    const headers: OutgoingHttpHeaders = { ...request.headers, host: target.host };
    delete headers["proxy-authorization"];
    delete headers["proxy-connection"];

    const upstream = createHTTPRequest({
      family: endpoint.family,
      headers,
      hostname: endpoint.address,
      method: request.method,
      path: `${target.pathname}${target.search}`,
      port
    });
    upstream.setTimeout(AgentWebProxyTimeoutMs, () => upstream.destroy(new Error("代理连接超时")));
    upstream.on("response", (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on("aborted", () => upstream.destroy());
    request.pipe(upstream);
  } catch {
    denyHTTPProxyRequest(response);
  }
}

async function proxyHTTPSConnect(request: IncomingMessage, client: Socket, head: Buffer) {
  try {
    if (!request.url) throw new Error("代理请求缺少目标地址");
    const target = new URL(`http://${request.url}`);
    if (target.username || target.password || Number(target.port || 80) !== 443) {
      throw new Error("HTTPS 代理仅允许标准端口");
    }

    const endpoint = await resolveProxyEndpoint(target.hostname);
    const upstream = createSocket({
      family: endpoint.family,
      host: endpoint.address,
      port: 443
    });
    upstream.setTimeout(AgentWebProxyTimeoutMs, () => upstream.destroy(new Error("代理连接超时")));
    upstream.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.once("error", () => denyHTTPSProxyRequest(client));
    client.once("error", () => upstream.destroy());
    client.once("close", () => upstream.destroy());
  } catch {
    denyHTTPSProxyRequest(client);
  }
}

async function resolveProxyEndpoint(hostname: string) {
  const endpoints = await resolvePublicWebHostname(hostname);
  const endpoint = endpoints.find(({ family }) => family === 4) ?? endpoints[0];
  if (!endpoint) throw new Error("目标域名无法安全解析");
  return endpoint;
}

function denyHTTPProxyRequest(response: ServerResponse) {
  if (!response.headersSent) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
  }
  response.end("Forbidden");
}

function denyHTTPSProxyRequest(socket: Socket) {
  if (socket.destroyed) return;
  socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
}
