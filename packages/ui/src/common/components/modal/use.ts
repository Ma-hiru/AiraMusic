import { useLayoutEffect } from "react";
import { type ModalRender } from "./modal-provider";
import { Log } from "@/common/lib/log";
import { createAlbumCoverModal, createPlaylistCoverModal } from "./playlist-cover-modal";
import Provider from "./modal-provider";

export default class AppModal {
  static _setModalData: NormalFunc<[data: Nullable<ModalRender>]> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
  };

  static _setModalVisible: NormalFunc<[show?: boolean]> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
  };

  private static renderGetter: NormalFunc<[], Nullable<ModalRender>> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
    return null;
  };

  private static visibleGetter: NormalFunc<[], boolean> = () => {
    Log.warn("AppModal", "Modal is not provided in this app");
    return false;
  };

  static readonly _create = <U extends unknown[]>(
    creator: NormalFunc<U, ModalRender>,
    ...props: U
  ) => {
    AppModal._setModalData?.(creator(...props));
    AppModal._setModalVisible?.(true);
    return AppModal.visibleGetter;
  };

  static get useModal() {
    return useModal;
  }

  static close() {
    if (!AppModal.visibleGetter?.()) return;
    AppModal._setModalVisible?.(false);
  }

  static _inject(hooks: {
    setData: typeof AppModal._setModalData;
    setVisible: typeof AppModal._setModalVisible;
    renderGetter: typeof AppModal.renderGetter;
    visibleGetter: typeof AppModal.visibleGetter;
  }) {
    AppModal._setModalData = hooks.setData;
    AppModal._setModalVisible = hooks.setVisible;
    AppModal.renderGetter = hooks.renderGetter;
    AppModal.visibleGetter = hooks.visibleGetter;
  }

  static readonly Provider = Provider;
}

function useModal() {
  useLayoutEffect(() => {
    return () => {
      AppModal._setModalData?.(null);
      AppModal._setModalVisible?.(false);
    };
  }, []);

  return {
    create: AppModal._create,
    close: AppModal.close,
    createPlaylistCoverModal,
    createAlbumCoverModal
  };
}
