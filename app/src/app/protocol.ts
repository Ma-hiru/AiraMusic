import mime from "mime";
import { createReadStream } from "node:fs";
import { normalize } from "node:path";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { Log } from "../utils/log";
import { app, protocol } from "electron";

export class AppProtocol {
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
          bypassCSP: true
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
      // todo 限制访问权限
      const fileStat = await stat(filePath);
      const total = fileStat.size;
      const rangeHeader = request.headers.get("range") ?? request.headers.get("Range");
      // 优先使用 URL 查询参数中的 MIME 类型，否则根据文件扩展名猜测
      const mimeFromQuery = url.searchParams.get("mime");
      const contentType = mimeFromQuery || mime.getType(filePath) || "application/octet-stream";
      const commonHeaders = {
        "Accept-Ranges": "bytes",
        "Content-Type": contentType
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
        const nodeStream = createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(nodeStream);
        return new Response(webStream as ReadableStream, {
          status: 206,
          headers: {
            ...commonHeaders,
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${start}-${end}/${total}`
          }
        });
      }

      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream);
      return new Response(webStream as ReadableStream, {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Length": total.toString()
        }
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
