import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";

let requestToast: NormalFunc<[data: Omit<ToastItemData, "id">], string> = () => {
  Log.error(Errs.ToastBeforeInject.create("requestToast"));
  return "";
};

let disposeToast: NormalFunc<[id: string]> = () => {
  Log.error(Errs.ToastBeforeInject.create("disposeToast"));
};

export function useToast() {
  return { requestToast, disposeToast };
}

export function injectToast(
  request: NormalFunc<[data: Omit<ToastItemData, "id">], string>,
  dispose: NormalFunc<[id: string]>
) {
  requestToast = request;
  disposeToast = dispose;
}
