import _AppRenderer from "@/common/source/electron/services/renderer";

export class RendererRuntime {
  static id = "";
  static readonly isDev = import.meta.env.DEV;
  static readonly isRelease = import.meta.env.PROD;
  static readonly isTest = String(import.meta.env.APP_TEST) === "true";
}

requestAnimationFrame(async () => {
  RendererRuntime.id = RendererRuntime.isTest
    ? ""
    : await _AppRenderer.Event.invoke("runtimeID", undefined);
});
