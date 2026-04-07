import { ModalData } from "@mahiru/ui/public/components/modal/ModalProvider";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";

export default class AppModal {
  private static toggleModalVisible: NormalFunc<[visible?: boolean | undefined]> = () => {
    Log.error(Errs.ModalBeforeInject.derive("toggleModalVisible"));
  };
  private static setModalRenderData: NormalFunc<[data: Nullable<ModalData>]> = () => {
    Log.error(Errs.ModalBeforeInject.derive("setModalRenderData"));
  };
  private static getRender: NormalFunc<[], Nullable<ModalData>> = () => {
    Log.error(Errs.ModalBeforeInject.derive("getRender"));
    return null;
  };
  static getVisible: NormalFunc<[], boolean> = () => {
    Log.error(Errs.ModalBeforeInject.derive("getVisible"));
    return false;
  };

  static useModal() {
    return {
      toggleModalVisible: AppModal.toggleModalVisible,
      setModalRenderData: AppModal.setModalRenderData,
      getRender: AppModal.getRender,
      getVisible: AppModal.getVisible
    };
  }

  static inject(hooks: {
    toggleModalVisible: typeof AppModal.toggleModalVisible;
    setModalRenderData: typeof AppModal.setModalRenderData;
    getRender: typeof AppModal.getRender;
    getVisible: typeof AppModal.getVisible;
  }) {
    AppModal.toggleModalVisible = hooks.toggleModalVisible;
    AppModal.setModalRenderData = hooks.setModalRenderData;
    AppModal.getRender = hooks.getRender;
    AppModal.getVisible = hooks.getVisible;
  }
}
