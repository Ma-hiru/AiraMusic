import mime from "mime";
import { app, protocol } from "electron";
import { Readable } from "node:stream";
import { normalize } from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { isSubPath } from "@/utils/sub-path";

export class MainProtocol {
  private static init = false;

  static register() {
    if (this.init) return;
    this.init = true;
    protocol.registerSchemesAsPrivileged([
      {
        scheme: process.env.APP_SCHEME,
        privileges: {
          secure: true,
          standard: true,
          supportFetchAPI: true,
          bypassCSP: true,
          stream: false,
          corsEnabled: true
        }
      }
    ]);
    app.whenReady().then(() => {
      protocol.handle(process.env.APP_SCHEME, async (request) => {
        try {
          // url.hostname === "local"
          // url.pathname === "/C:/Users/xxx.png"
          if (new URL(request.url).hostname === "local") {
            return this.localFile(request);
          }
        } catch (err) {
          Log.error({
            raw: err,
            message: "protocol error",
            label: "protocol"
          });
        }
        return new Response("Not Found", { status: 404 });
      });
    });
  }

  private static async localFile(request: Request) {
    try {
      // url.hostname === "local"
      const url = new URL(request.url);
      // url.pathname === "/C:/Users/xxx.png"
      const filePath = normalize(decodeURIComponent(url.pathname.slice(1)));
      // 限制访问权限
      const legal = isSubPath(MainHandle.allowedPath, filePath);
      if (!legal) return new Response("Not Found", { status: 404 });
      // 检查文件
      const fileStat = await stat(filePath);
      const total = fileStat.size;
      const rangeHeader = request.headers.get("range") ?? request.headers.get("Range");
      // 优先使用 URL 查询参数中的 MIME 类型，否则根据文件扩展名猜测
      const mimeFromQuery = url.searchParams.get("mime");
      const contentType = mimeFromQuery || mime.getType(filePath) || "application/octet-stream";
      const commonHeaders = {
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin"
      } as Record<string, string>;

      if (rangeHeader && rangeHeader.startsWith("bytes=")) {
        const { start, end } = this.parseRange(rangeHeader, total);
        if (start >= total || end >= total) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: {
              ...commonHeaders,
              "Content-Range": `bytes */${total}`
            }
          });
        }
        const chunkSize = end - start + 1;
        return this.streamResponse(filePath, { start, end }, request.signal, 206, {
          ...commonHeaders,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${total}`
        });
      }

      return this.streamResponse(filePath, undefined, request.signal, 200, {
        ...commonHeaders,
        "Content-Length": total.toString()
      });
    } catch (err) {
      Log.error({
        raw: err,
        message: "protocol error",
        label: "protocol"
      });
      return new Response("Not Found", { status: 404 });
    }
  }

  private static streamResponse(
    filePath: string,
    options: { start: number; end: number } | undefined,
    signal: AbortSignal,
    status: number,
    headers: Record<string, string>
  ) {
    const nodeStream = options ? createReadStream(filePath, options) : createReadStream(filePath);

    if (signal.aborted) {
      nodeStream.destroy();
    } else {
      const onAbort = () => nodeStream.destroy();
      signal.addEventListener("abort", onAbort, { once: true });
      nodeStream.once("close", () => signal.removeEventListener("abort", onAbort));
    }
    // 读取错误
    nodeStream.once("error", (err) => {
      !err.message.includes("aborted") && Log.error("protocol", "read stream error", err);
    });

    return new Response(Readable.toWeb(nodeStream) as ReadableStream, { status, headers });
  }

  private static parseRange(rangeHeader: string, size: number) {
    // bytes=0-499
    const value = rangeHeader.replace(/bytes=/i, "");
    const [startStr, endStr] = value.split("-");
    let start = startStr ? Number(startStr) : 0;
    let end = endStr ? Number(endStr) : size - 1;

    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start < 0) {
      const suffix = Math.min(-start, size);
      start = size - suffix;
    }
    if (start > end) start = 0;
    return { start, end };
  }
}
