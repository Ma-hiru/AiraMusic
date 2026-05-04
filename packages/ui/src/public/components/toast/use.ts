import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { Log } from "@mahiru/ui/public/utils/dev";
import Provider from "./ToastProvider";

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
