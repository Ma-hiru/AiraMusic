import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { Inject } from "@/common/utils/inject";

import Provider, { type ModalRender } from "./modal-provider";

const defaultHandler = () => {
  Log.warn("AppModal", "Modal is not provided in this app, or running under React StrictMode");
  return null;
};

@Inject
export default class AppModal {
  static __setModalData: NormalFunc<[data: Nullable<ModalRender>]> = defaultHandler;
  static __setModalVisible: NormalFunc<[show?: boolean]> = defaultHandler;
  static __renderGetter: NormalFunc<[], Nullable<ModalRender>> = defaultHandler;
  static __visibleGetter: NormalFunc<[], boolean> = () => defaultHandler() || false;

  static _create<const U extends unknown[]>(creator: NormalFunc<U, ModalRender>, ...props: U) {
    AppModal.__setModalData?.(creator(...props));
    AppModal.__setModalVisible?.(true);
    return AppModal.__visibleGetter;
  }

  static get useModal() {
    return useModal;
  }

  static close() {
    if (!AppModal.__visibleGetter?.()) return;
    AppModal.__setModalVisible?.(false);
  }

  static readonly Provider = Provider;
}

function useModal() {
  useEffect(() => {
    return () => {
      AppModal.__setModalData?.(null);
      AppModal.__setModalVisible?.(false);
    };
  }, []);

  return {
    create: AppModal._create,
    close: AppModal.close
  };
}
