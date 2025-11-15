import moduleDefs from "./ncmModDef";
import { ensureAnonToken } from "./ensureAnonToken";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";

type ServerModule = typeof import("@neteasecloudmusicapienhanced/api/server.js");
let serverImpl: ServerModule["default"] | undefined;

async function loadServer() {
  if (!serverImpl) {
    await ensureAnonToken();
    const mod = await import("@neteasecloudmusicapienhanced/api/server.js");
    serverImpl = mod.default;
  }
  return serverImpl;
}

export function startNeteaseMusicApiServer() {
  loadServer()
    .then((server) => {
      return server.serveNcmApi({ port: 10754, moduleDefs });
    })
    .catch((err) => {
      Log.error(
        new EqError({
          label: "app/netease.ts",
          message: "Failed to start Netease Music API server",
          raw: err
        })
      );
    });
}
