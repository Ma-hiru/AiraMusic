import { rendererInvokeAPI } from "./invoke";
import { rendererEventAPI } from "./event";

export default class AppIPCRender {
  static readonly invoke = rendererInvokeAPI;
  static readonly event = rendererEventAPI;
}
