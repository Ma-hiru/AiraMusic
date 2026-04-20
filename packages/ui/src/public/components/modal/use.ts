import { ModalData } from "@mahiru/ui/public/components/modal/ModalProvider";
import { Log } from "@mahiru/ui/public/utils/dev";
import Provider from "./ModalProvider";

export default class AppModal {
  private static toggleModalVisible: NormalFunc<[visible?: boolean | undefined]> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
  };
  private static setModalRenderData: NormalFunc<[data: Nullable<ModalData>]> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
  };
  private static getRender: NormalFunc<[], Nullable<ModalData>> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
    return null;
  };
  static getVisible: NormalFunc<[], boolean> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
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

  static Provider = Provider;
}
