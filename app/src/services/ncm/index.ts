import moduleDefs from "./ncmModDef";
import { ensureAnonToken } from "./ensureAnonToken";
import { EqError } from "../../utils/err";

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

export async function startNeteaseMusicApiServer() {
  try {
    const port = Number(process.env.NCM_SERVER_PORT);
    const server = await loadServer();
    return await server.serveNcmApi({ port, moduleDefs });
  } catch (err) {
    throw new EqError({
      label: "app/netease.ts",
      message: "Failed to start Netease Music API server",
      raw: err
    });
  }
}
