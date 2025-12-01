import mime from "mime";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { EqError } from "../utils/err";
import { Log } from "../utils/log";
import { app, protocol } from "electron";

export function registerAppProtocol() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "mahiru",
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        bypassCSP: true
      }
    }
  ]);

  app.whenReady().then(() => {
    protocol.handle("mahiru", async (request) => {
      try {
        // url.hostname === "local"
        // url.pathname === "/C:/Users/xxx.png"
        const url = new URL(request.url);
        if (url.hostname === "local") {
          return handleProtocolLocal(request);
        }
        return new Response("Not Found", { status: 404 });
      } catch (err) {
        Log.trace(
          new EqError({
            raw: err,
            message: "protocol error",
            label: "app/appEvent.ts:mahiru protocol"
          })
        );
        return new Response("Not Found", { status: 404 });
      }
    });
  });
}

async function handleProtocolLocal(request: Request) {
  try {
    // url.hostname === "local"
    const url = new URL(request.url);
    // url.pathname === "/C:/Users/xxx.png"
    const filePath = decodeURIComponent(url.pathname.slice(1));
    const fileStat = await stat(filePath);
    const total = fileStat.size;
    const rangeHeader = request.headers.get("range") ?? request.headers.get("Range");
    const contentType = mime.getType(filePath) ?? "application/octet-stream";
    const commonHeaders = {
      "Accept-Ranges": "bytes",
      "Content-Type": contentType
    } as Record<string, string>;

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const { start, end } = parseRange(rangeHeader, total);
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
      const webStream = toWebReadable(nodeStream);
      return new Response(webStream, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${total}`
        }
      });
    }

    const nodeStream = createReadStream(filePath);
    const webStream = toWebReadable(nodeStream);
    return new Response(webStream, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": total.toString()
      }
    });
  } catch (err) {
    Log.trace(
      new EqError({
        raw: err,
        message: "protocol error",
        label: "app/appEvent.ts:mahiru protocol"
      })
    );
    return new Response("Not Found", { status: 404 });
  }
}

function parseRange(rangeHeader: string, size: number) {
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

function toWebReadable(stream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(stream as any) as unknown as ReadableStream;
}
