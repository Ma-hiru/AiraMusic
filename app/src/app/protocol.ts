import mime from "mime";
import { readFile } from "node:fs/promises";
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
    // url.pathname === "/C:/Users/xxx.png"
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.slice(1)); // 去掉开头的 "/"
    return new Response(await readFile(filePath), {
      headers: {
        "Content-Type": mime.getType(filePath) ?? "application/octet-stream"
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
