import express from "express";
import expressProxy from "express-http-proxy";
import { join } from "node:path";
import { MainPathResolver } from "@/lib/path-resolver";

export default class ProxyService {
  instance;
  onError;

  constructor(props: {
    onError?: NormalFunc<[err: Error]>;
    port: number;
    ncmPort: number;
    storePort: number;
  }) {
    this.onError = props.onError;
    const expressAPP = express();
    const serveHtml = (file: string) => (_req: express.Request, res: express.Response) => {
      res.sendFile(join(MainPathResolver.staticUIDir, file));
    };

    expressAPP.use("/", express.static(MainPathResolver.staticUIDir));
    expressAPP.get("/login", serveHtml("login.html"));
    expressAPP.get("/info", serveHtml("info.html"));
    expressAPP.get("/lyric", serveHtml("lyric.html"));
    expressAPP.get("/image", serveHtml("image.html"));
    expressAPP.get("/tray", serveHtml("tray.html"));
    expressAPP.get("/mini", serveHtml("mini.html"));
    expressAPP.use(
      "/api",
      expressProxy(`http://127.0.0.1:${props.ncmPort}`, {
        timeout: 15000
      })
    );
    expressAPP.use(
      "/cache",
      expressProxy(`http://127.0.0.1:${props.storePort}`, {
        timeout: 15000
      })
    );
    expressAPP.post("/log", (request, response) => {
      if (
        request.headers["content-type"] === "application/json" &&
        typeof request.body === "string"
      ) {
        const { type, text } = <Record<string, string>>JSON.parse(request.body || "{}");
        // TODO
      }

      response.status(204);
    });

    this.instance = expressAPP.listen(props.port, "127.0.0.1").on("error", (e) => {
      this.onError?.(e);
    });
  }

  stop() {
    this.instance.close();
  }
}
