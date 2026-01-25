import express from "express";
import expressProxy from "express-http-proxy";
import { Log } from "../../utils/log";
import { staticUIDir } from "../../utils/path";

export function createProxyServer() {
  Log.debug("Create Express APP");
  const expressAPP = express();
  const port = Number(process.env.EXPRESS_SERVER_PORT);
  const ncmPort = Number(process.env.NCM_SERVER_PORT);
  const cachePort = Number(process.env.GO_SERVER_PORT);
  expressAPP.use("/", express.static(staticUIDir));
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

  return expressAPP.listen(port, "127.0.0.1");
}
