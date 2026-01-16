import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";

export const LayoutStoreConfig: ZustandConfig<
  LayoutStoreInitialState & LayoutStoreActions,
  LayoutStoreInitialState
> = (set, get) => ({
  ...InitialState,
  UpdatePlayerTheme: (theme) => {
    set((draft) => {
      draft.PlayerTheme = {
        ...draft.PlayerTheme,
        ...theme
      };
    });
  },
  UpdateScrollTop: (data) => {
    set((draft) => {
      if (draft.ScrollTop.type !== data.type) {
        draft.ScrollTop = data;
      }
    });
  },
  UpdateContextMenu: (data) => {
    set((draft) => {
      draft.ContextMenu = {
        ...draft.ContextMenu,
        ...data
      };
    });
  },
  TogglePlayerVisible: () => {
    set((draft) => {
      draft.PlayerVisible = !draft.PlayerVisible;
    });
  },
  ToggleSideBarOpen: () => {
    set((draft) => {
      draft.SideBarOpen = !draft.SideBarOpen;
    });
  },
  SetIsTyping: (isTyping) => {
    set((draft) => {
      draft.IsTyping = isTyping;
    });
  },
  SetTrackListFastLocater: (locator) => {
    set((draft) => {
      draft.TrackListFastLocater = locator;
    });
  },
  UpdateRequestToast: (requestToast) => {
    set((draft) => {
      draft.RequestToast = requestToast;
    });
  }
});

const InitialState: LayoutStoreInitialState = {
  ScrollTop: {
    type: "none",
    callback: null
  },
  PlayerVisible: false,
  SideBarOpen: false,
  PlayerTheme: {
    BackgroundCover: undefined,
    KmeansColor: []
  },
  IsTyping: false,
  ContextMenu: {
    visible: false,
    visibleSetter: () => null,
    rendererGetter: () => null
  },
  RequestToast: null,
  TrackListFastLocater: () => null
};

export type LayoutStoreInitialState = {
  ScrollTop: {
    type: LayoutCanScrollTop;
    callback: Nullable<NormalFunc>;
  };
  PlayerVisible: boolean;
  SideBarOpen: boolean;
  PlayerTheme: {
    BackgroundCover: Undefinable<string>;
    KmeansColor: string[];
  };
  IsTyping: boolean;
  ContextMenu: {
    visible: boolean;
    visibleSetter: NormalFunc<[], Nullable<(visible?: boolean) => void>>;
    rendererGetter: NormalFunc<[], Nullable<(data: Nullable<ContextMenuRender>) => void>>;
  };
  RequestToast: Nullable<(data: ToastItemData) => void>;
  TrackListFastLocater: NormalFunc<[], Nullable<() => void>>;
};

export type LayoutStoreActions = {
  UpdatePlayerTheme: NormalFunc<[theme: Partial<LayoutStoreInitialState["PlayerTheme"]>]>;
  UpdateScrollTop: NormalFunc<[data: LayoutStoreInitialState["ScrollTop"]]>;
  UpdateContextMenu: NormalFunc<[data: Partial<LayoutStoreInitialState["ContextMenu"]>]>;
  UpdateRequestToast: NormalFunc<[requestToast: (data: ToastItemData) => void]>;
  TogglePlayerVisible: NormalFunc<[]>;
  ToggleSideBarOpen: NormalFunc<[]>;
  SetIsTyping: NormalFunc<[isTyping: boolean]>;
  SetTrackListFastLocater: NormalFunc<[locater: LayoutStoreInitialState["TrackListFastLocater"]]>;
};
