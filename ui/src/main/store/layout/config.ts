import { createZustandConfig } from "@mahiru/ui/public/utils/store";
import UI from "@mahiru/ui/public/entry/ui";

export const LayoutStoreConfig = createZustandConfig((set): LayoutStoreType => {
  return {
    layout: new LayoutConfig(),
    theme: new ThemeConfig(),
    other: new OtherConfig(),
    updateLayout(layout) {
      set((draft) => {
        draft.layout = layout;
      });
    },
    updateTheme(theme) {
      set((draft) => {
        draft.theme = theme;
      });
    },
    updateOther(other) {
      set((draft) => {
        draft.other = other;
      });
    }
  };
});

export type LayoutStoreType = {
  layout: LayoutConfig;
  theme: ThemeConfig;
  other: OtherConfig;
  updateLayout: (layout: LayoutConfig) => void;
  updateTheme: (theme: ThemeConfig) => void;
  updateOther: (other: OtherConfig) => void;
};

class LayoutConfig {
  sideBar;
  playModal;
  scrollTop;
  fastLocate;

  constructor(props?: {
    sideBar?: boolean;
    playModal?: boolean;
    scrollTop?: NormalFunc;
    fastLocate?: NormalFunc;
  }) {
    this.sideBar = props?.sideBar ?? false;
    this.playModal = props?.playModal ?? false;
    this.scrollTop = props?.scrollTop;
    this.fastLocate = props?.fastLocate;
  }

  setScrollTop(cb: NormalFunc) {
    this.scrollTop = cb;
    return this;
  }

  setFastLocate(cb: NormalFunc) {
    this.fastLocate = cb;
    return this;
  }

  setSideBar(sideBar: boolean) {
    this.sideBar = sideBar;
    return this;
  }

  setPlayModal(playModal: boolean) {
    this.playModal = playModal;
    return this;
  }

  copy() {
    return new LayoutConfig(this);
  }
}

class ThemeConfig {
  backgroundCover;
  themeColors;

  constructor(props?: { backgroundCover: Undefinable<string>; themeColors: string[] }) {
    this.backgroundCover = props?.backgroundCover;
    this.themeColors = props?.themeColors ?? [];
  }

  setBackgroundCover(cover: Undefinable<string>) {
    this.backgroundCover = cover;
    return this;
  }

  setThemeColors(themeColors: string[]) {
    this.themeColors = themeColors;
    return this;
  }

  get mainColor() {
    return this.themeColors[0] || UI.APPThemeColorDefault.main;
  }

  get secondaryColor() {
    return this.themeColors[1] || UI.APPThemeColorDefault.secondary;
  }

  copy() {
    return new ThemeConfig(this);
  }
}

class OtherConfig {
  typing;
  constructor(props?: { typing?: boolean }) {
    this.typing = props?.typing ?? false;
  }

  setTyping(typing: boolean) {
    this.typing = typing;
    return this;
  }
  copy() {
    return new OtherConfig(this);
  }
}
