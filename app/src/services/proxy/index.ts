import express from "express";
import expressProxy from "express-http-proxy";
import { join } from "node:path";
import { Log } from "../../utils/log";
import { staticUIDir } from "../../utils/path";

export default class ProxyService {
  static create(onError?: NormalFunc<[err: Error]>) {
    const expressAPP = express();
    const port = process.env.EXPRESS_SERVER_PORT;
    const ncmPort = process.env.NCM_SERVER_PORT;
    const cachePort = process.env.GO_SERVER_PORT;

    const serveHtml = (file: string) => (_req: express.Request, res: express.Response) => {
      res.sendFile(join(staticUIDir, file));
    };

    expressAPP.use("/", express.static(staticUIDir));
    expressAPP.get("/login", serveHtml("login.html"));
    expressAPP.get("/info", serveHtml("info.html"));
    expressAPP.get("/lyric", serveHtml("lyric.html"));
    expressAPP.get("/image", serveHtml("image.html"));
    expressAPP.get("/tray", serveHtml("tray.html"));
    expressAPP.get("/mini", serveHtml("mini.html"));
    expressAPP.use(
      "/api",
      expressProxy(`http://127.0.0.1:${ncmPort}`, {
        timeout: 15000
      })
    );
    expressAPP.use(
      "/cache",
      expressProxy(`http://127.0.0.1:${cachePort}`, {
        timeout: 15000
      })
    );
    expressAPP.post("/log", (request, response) => {
      if (
        request.headers["content-type"] === "application/json" &&
        typeof request.body === "string"
      ) {
        const { type, text } = JSON.parse(request.body || "{}");
        Log[type as keyof typeof Log]?.(text);
      }

      response.status(204);
    });

    return expressAPP.listen(port, "127.0.0.1").on("error", (e) => {
      onError?.(e);
    });
  }
}
