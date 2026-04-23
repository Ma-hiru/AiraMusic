import { rendererInvokeAPI } from "./invoke";
import { rendererEventAPI } from "./event";
import { rendererEventListenerAPI } from "./listener";

export default class AppIPCRender {
  static readonly invoke = rendererInvokeAPI;
  static readonly event = rendererEventAPI;
  static readonly listener = rendererEventListenerAPI;
}
