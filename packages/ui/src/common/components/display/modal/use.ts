import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { createAddToPlaylistModal } from "./add-to-playlist-modal";
import { createDialogModal } from "./dialog-modal";
import { createAlbumCoverModal, createPlaylistCoverModal } from "./playlist-cover-modal";
import { createPlaylistCreateModal } from "./playlist-create-modal";
import { createPlaylistEditModal } from "./playlist-edit-modal";
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

  static _create<U extends unknown[]>(creator: NormalFunc<U, ModalRender>, ...props: U) {
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
    close: AppModal.close,
    createPlaylistCoverModal,
    createAlbumCoverModal,
    createDialogModal,
    createAddToPlaylistModal,
    createPlaylistCreateModal,
    createPlaylistEditModal
  };
}
