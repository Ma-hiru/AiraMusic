import { ModalData } from "@mahiru/ui/public/components/modal/ModalProvider";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";

let toggleModalVisible: NormalFunc<[visible?: boolean | undefined]> = () => {
  Log.error(Errs.ModalBeforeInject.create("toggleModalVisible"));
};
let setModalRenderData: NormalFunc<[data: Nullable<ModalData>]> = () => {
  Log.error(Errs.ModalBeforeInject.create("setModalRenderData"));
};
let getRender: NormalFunc<[], Nullable<ModalData>> = () => {
  Log.error(Errs.ModalBeforeInject.create("getRender"));
  return null;
};
let getVisible: NormalFunc<[], boolean> = () => {
  Log.error(Errs.ModalBeforeInject.create("getVisible"));
  return false;
};

export function useModal() {
  return { toggleModalVisible, setModalRenderData, getRender, getVisible };
}

export function injectModal(hooks: {
  toggleModalVisible: typeof toggleModalVisible;
  setModalRenderData: typeof setModalRenderData;
  getRender: typeof getRender;
  getVisible: typeof getVisible;
}) {
  toggleModalVisible = hooks.toggleModalVisible;
  setModalRenderData = hooks.setModalRenderData;
  getRender = hooks.getRender;
  getVisible = hooks.getVisible;
}
