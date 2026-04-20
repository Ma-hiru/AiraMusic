import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { Log } from "@mahiru/ui/public/utils/dev";
import Provider from "./ToastProvider";

export default class AppToast {
  static request: NormalFunc<[data: Omit<ToastItemData, "id">], string> = () => {
    Log.warn("AppToast", "Toast is not provided in this app");
    return "";
  };

  static dispose: NormalFunc<[id: string]> = () => {
    Log.warn("AppToast", "Toast is not provided in this app");
  };

  static inject(
    request: NormalFunc<[data: Omit<ToastItemData, "id">], string>,
    dispose: NormalFunc<[id: string]>
  ) {
    AppToast.request = request;
    AppToast.dispose = dispose;
  }

  static Provider = Provider;
}
