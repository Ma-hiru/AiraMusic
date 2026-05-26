import { type ToastItemData } from "./toast-item";
import { Log } from "@/common/lib/log";
import Provider from "./toast-provider";

export default class AppToast {
  static show: NormalFunc<[data: Omit<ToastItemData, "id">], string> = () => {
    Log.warn("AppToast", "Toast is not provided in this app");
    return "";
  };

  static dispose: NormalFunc<[id: string]> = () => {
    Log.warn("AppToast", "Toast is not provided in this app");
  };

  static _inject(hooks: { show: typeof AppToast.show; dispose: typeof AppToast.dispose }) {
    AppToast.show = hooks.show;
    AppToast.dispose = hooks.dispose;
  }

  static Provider = Provider;
}
