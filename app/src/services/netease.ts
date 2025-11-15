import server from "@neteasecloudmusicapienhanced/api/server";
import moduleDefs from "./ncmModDef";

export async function startNeteaseMusicApiServer() {
  await server.serveNcmApi({
    port: 10754,
    moduleDefs
  });
}
