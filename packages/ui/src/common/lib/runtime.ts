import { RendererIPC } from "@/common/lib/ipc";

// test时使用mock返回空数据
const isTest = String(import.meta.env.APP_TEST).toLowerCase() === "true";
const id = await RendererIPC.Invoke("runtimeID", undefined).catch(() => crypto.randomUUID());
const accessToken = await RendererIPC.Invoke("storeKey", undefined).catch(() => "mahiru");
const currentWindowType: WindowType = await RendererIPC.Invoke(
  "currentWindowType",
  undefined
).catch(() => "main");

export class RendererRuntime {
  static readonly id = id;
  static readonly isTest = isTest;
  static readonly cacheAccessToken = accessToken;
  static readonly currentWindowType = currentWindowType;
  static readonly name = import.meta.env.APP_NAME;
}
