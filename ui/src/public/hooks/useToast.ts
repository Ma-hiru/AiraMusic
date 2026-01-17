import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

let requestToast: NormalFunc<[data: Omit<ToastItemData, "id">], string>;
let disposeToast: NormalFunc<[id: string]>;

export function useToast() {
  if (!requestToast) {
    Log.error(
      new EqError({
        label: "useToast",
        message:
          "before using useToast, make sure that ToastProvider is mounted and injectToast has been called."
      })
    );
  }
  return { requestToast, disposeToast };
}

export function injectToast(
  request: NormalFunc<[data: Omit<ToastItemData, "id">], string>,
  dispose: NormalFunc<[id: string]>
) {
  requestToast = request;
  disposeToast = dispose;
}
