import { Log } from "../utils/log";
import express from "express";
import { staticPath } from "../utils/path";
import expressProxy from "express-http-proxy";

export function createExpressApp() {
  Log.debug("Create Express APP");
  const expressAPP = express();
  expressAPP.use("/", express.static(staticPath));
  expressAPP.use("/api", expressProxy("http://127.0.0.1:10754"));
  //TODO: player
  return expressAPP.listen(27232, "127.0.0.1");
}
