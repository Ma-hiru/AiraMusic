import { RendererIPC } from "@/common/lib/ipc";
import Init from "@/common/utils/init";

export class RendererRuntime {
  static id = "";
  static readonly isTest = String(import.meta.env.APP_TEST).toLowerCase() === "true";
  static async _init() {
    RendererRuntime.id = RendererRuntime.isTest
      ? ""
      : await RendererIPC.Invoke("runtimeID", undefined);
  }
}

Init.initMicrotask(RendererRuntime);
