import { RendererIPC } from "@mahiru/ipc/renderer";

/** test时使用mock返回空数据 */
const isTest = String(import.meta.env.APP_TEST).toLowerCase() === "true";
const id = await RendererIPC.NormalChannel.send("invoke_runtime_id", undefined).catch(() =>
  crypto.randomUUID()
);
const accessToken = await RendererIPC.NormalChannel.send("invoke_runtime_token", undefined).catch(
  () => "mahiru"
);
const currentWindowType: WindowType = await RendererIPC.NormalChannel.send(
  "invoke_window_id",
  undefined
).catch(() => "main");

export class RendererRuntime {
  static readonly id = id;
  static readonly isTest = isTest;
  static readonly cacheAccessToken = accessToken;
  static readonly currentWindowType = currentWindowType;
  static readonly name = import.meta.env.APP_NAME;
}
