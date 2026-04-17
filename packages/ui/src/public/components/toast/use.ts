import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/constants/errs";
import Provider from "./ToastProvider";

export default class AppToast {
  static request: NormalFunc<[data: Omit<ToastItemData, "id">], string> = () => {
    Log.error(Errs.ToastBeforeInject.derive("requestToast"));
    return "";
  };

  static dispose: NormalFunc<[id: string]> = () => {
    Log.error(Errs.ToastBeforeInject.derive("disposeToast"));
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
