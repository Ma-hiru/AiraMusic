import { createZustandConfig } from "@mahiru/ui/public/utils/store";
import AppUI from "@mahiru/ui/public/entry/ui";
import Eq from "@mahiru/ui/public/models/Eq";

export const LayoutStoreConfig = createZustandConfig((set): LayoutStoreType => {
  return {
    layout: new LayoutConfig(),
    theme: new ThemeConfig(),
    other: new OtherConfig(),
    updateLayout(layout) {
      set((draft) => {
        if (!draft.layout.eq(layout)) draft.layout = layout;
      });
    },
    updateTheme(theme) {
      set((draft) => {
        if (!draft.theme.eq(theme)) draft.theme = theme;
      });
    },
    updateOther(other) {
      set((draft) => {
        if (!draft.other.eq(other)) draft.other = other;
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

export class LayoutConfig extends Eq<LayoutConfig> {
  sideBar;
  playModal;
  scrollTop;
  fastLocator;

  eq(other: LayoutConfig) {
    const base = super.eq(other);
    return (
      base && this.scrollTop() === other.scrollTop() && this.fastLocator() === other.fastLocator()
    );
  }

  constructor(props?: {
    sideBar?: boolean;
    playModal?: boolean;
    scrollTop?: () => Optional<NormalFunc>;
    fastLocator?: () => Optional<NormalFunc>;
  }) {
    super();
    this.sideBar = props?.sideBar ?? false;
    this.playModal = props?.playModal ?? false;
    this.scrollTop = props?.scrollTop || (() => null);
    this.fastLocator = props?.fastLocator || (() => null);
  }

  copy() {
    return new LayoutConfig(this);
  }

  setScrollTop(cb: Optional<NormalFunc>) {
    this.scrollTop = () => cb;
    return this;
  }

  setFastLocator(cb: Optional<NormalFunc>) {
    this.fastLocator = () => cb;
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
}

export class ThemeConfig extends Eq<ThemeConfig> {
  backgroundCover;
  themeColors;

  constructor(props?: { backgroundCover: Undefinable<string>; themeColors: string[] }) {
    super();
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
    return this.themeColors[0] || AppUI.themeDefault.main;
  }

  get secondaryColor() {
    return this.themeColors[1] || AppUI.themeDefault.secondary;
  }

  copy() {
    return new ThemeConfig(this);
  }
}

export class OtherConfig extends Eq<OtherConfig> {
  typing;

  constructor(props?: { typing?: boolean }) {
    super();
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
