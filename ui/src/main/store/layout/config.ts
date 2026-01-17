import { ZustandConfig } from "@mahiru/ui/types/zustand";

export const LayoutStoreConfig: ZustandConfig<
  LayoutStoreInitialState & LayoutStoreActions,
  LayoutStoreInitialState
> = (set) => ({
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
  TrackListFastLocater: NormalFunc<[], Nullable<() => void>>;
};

export type LayoutStoreActions = {
  UpdatePlayerTheme: NormalFunc<[theme: Partial<LayoutStoreInitialState["PlayerTheme"]>]>;
  UpdateScrollTop: NormalFunc<[data: LayoutStoreInitialState["ScrollTop"]]>;
  TogglePlayerVisible: NormalFunc<[]>;
  ToggleSideBarOpen: NormalFunc<[]>;
  SetIsTyping: NormalFunc<[isTyping: boolean]>;
  SetTrackListFastLocater: NormalFunc<[locater: LayoutStoreInitialState["TrackListFastLocater"]]>;
};
