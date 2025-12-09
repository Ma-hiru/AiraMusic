import { Log } from "../../utils/log";
import express from "express";
import { staticPath } from "../../utils/path";
import expressProxy from "express-http-proxy";

export function createProxyServer() {
  Log.debug("Create Express APP");
  const expressAPP = express();
  const port = Number(process.env.EXPRESS_SERVER_PORT);
  const ncmPort = Number(process.env.NCM_SERVER_PORT);
  const cachePort = Number(process.env.GO_SERVER_PORT);
  expressAPP.use("/", express.static(staticPath));
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
  //TODO: player
  return expressAPP.listen(port, "127.0.0.1");
}
