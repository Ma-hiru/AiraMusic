import { RendererIPC } from "@/common/lib/ipc";

const isTest = String(import.meta.env.APP_TEST).toLowerCase() === "true";
const id = await RendererIPC.Invoke("runtimeID", undefined);
const accessToken = await RendererIPC.Invoke("storeKey", undefined).catch(() => "mahiru");
const currentWindowType = await RendererIPC.Invoke("currentWindowType", undefined);

export class RendererRuntime {
  static readonly id = id;
  static readonly isTest = isTest;
  static readonly cacheAccessToken = accessToken;
  static readonly currentWindowType = currentWindowType;
}
