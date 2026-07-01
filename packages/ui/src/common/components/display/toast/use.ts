import { Log } from "@/common/lib/log";
import { Inject } from "@/common/utils/inject";

import Provider from "./toast-provider";
import { type ToastItemData } from "./toast-item";

const defaultHandler = () => {
  Log.warn("AppToast", "Toast is not provided in this app, or running under React StrictMode");
  return "";
};

@Inject
export default class AppToast {
  static __show: NormalFunc<[data: Omit<ToastItemData, "id">], string> = defaultHandler;
  static __dispose: NormalFunc<[id: string]> = defaultHandler;

  static get show() {
    return AppToast.__show;
  }

  static get dispose() {
    return AppToast.__dispose;
  }

  static Provider = Provider;
}
