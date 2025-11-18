import { Log } from "../utils/log";
import express from "express";
import { staticPath } from "../utils/path";
import expressProxy from "express-http-proxy";
import { CONSTANTS } from "../constant";

export function createExpressApp() {
  Log.debug("Create Express APP");
  const expressAPP = express();
  const port = CONSTANTS.APP.EXPRESS_PORT;
  const ncmPort = CONSTANTS.APP.NCM_PORT;
  expressAPP.use("/", express.static(staticPath));
  expressAPP.use(
    "/api",
    expressProxy(`http://127.0.0.1:${ncmPort}`, {
      timeout: 15000
    })
  );
  //TODO: player
  return expressAPP.listen(port, "127.0.0.1");
}
