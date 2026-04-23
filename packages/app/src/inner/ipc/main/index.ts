import { registerInvokeHandlers } from "./invoke";
import { registerEventHandlers } from "./event";

export default class AppIpcMain {
  static readonly registerInvokeHandlers = registerInvokeHandlers;
  static readonly registerEventHandlers = registerEventHandlers;
}
