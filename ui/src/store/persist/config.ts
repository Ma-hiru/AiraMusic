import { playlistCategories } from "@mahiru/ui/api/utils/staticData";
import pkg from "../../../package.json";
import shortcuts from "@mahiru/ui/api/utils/shortcuts";

const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name);

export const PersistStoreConfig: ZustandConfig<
  PersistStoreInitialState & PersistStoreActions,
  PersistStoreInitialState
> = (set, get) => ({
  ...InitialState,
  updatePersistStore(PartialState: Partial<PersistStoreInitialState>) {
    set((state) => {
      Object.entries(PartialState ?? {}).forEach(([key, value]) => {
        // oxlint-disable-next-line ban-ts-comment
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        state[key] = value;
      });
    });
  },
  updatePersistStoreData(PartialData: Partial<PersistStoreInitialState["data"]>) {
    set((state) => {
      Object.entries(PartialData ?? {}).forEach(([key, value]) => {
        // oxlint-disable-next-line ban-ts-comment
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        state.data[key] = value;
      });
    });
  },
  updatePersistStoreSettings(PartialSettings: Partial<PersistStoreInitialState["settings"]>) {
    set((state) => {
      Object.entries(PartialSettings ?? {}).forEach(([key, value]) => {
        // oxlint-disable-next-line ban-ts-comment
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        state.settings[key] = value;
      });
    });
  }
});

const InitialState: PersistStoreInitialState = {
  player: {},
  appVersion: pkg.version,
  settings: {
    lang: null,
    musicLanguage: "all",
    appearance: "auto",
    musicQuality: 320000,
    lyricFontSize: 28,
    outputDevice: "default",
    showPlaylistsByAppleMusic: true,
    enableUnblockNeteaseMusic: true,
    automaticallyCacheSongs: true,
    cacheLimit: 8192,
    enableReversedMode: false,
    nyancatStyle: false,
    showLyricsTranslation: true,
    lyricsBackground: true,
    enableOsdlyricsSupport: false,
    closeAppOption: "ask",
    enableDiscordRichPresence: false,
    enableGlobalShortcut: true,
    showLibraryDefault: false,
    subTitleDefault: false,
    linuxEnableCustomTitlebar: false,
    trayIconTheme: "auto",
    enabledPlaylistCategories,
    proxyConfig: {
      protocol: "noProxy",
      server: "",
      port: null
    },
    enableRealIP: false,
    realIP: null,
    shortcuts
  },
  data: {
    user: {},
    likedSongPlaylistID: 0,
    lastRefreshCookieDate: 0,
    loginMode: null
  }
};

export interface PersistStoreInitialState {
  player: Record<string, any>;
  appVersion: string;
  settings: {
    lang: string | null;
    musicLanguage: string;
    appearance: "light" | "dark" | "auto";
    musicQuality: number | string;
    lyricFontSize: number;
    outputDevice: string;
    showPlaylistsByAppleMusic: boolean;
    enableUnblockNeteaseMusic: boolean;
    automaticallyCacheSongs: boolean;
    cacheLimit: number;
    enableReversedMode: boolean;
    nyancatStyle: boolean;
    showLyricsTranslation: boolean;
    lyricsBackground: boolean;
    enableOsdlyricsSupport: boolean;
    closeAppOption: "ask" | "minimize" | "close";
    enableDiscordRichPresence: boolean;
    enableGlobalShortcut: boolean;
    showLibraryDefault: boolean;
    subTitleDefault: boolean;
    linuxEnableCustomTitlebar: boolean;
    trayIconTheme: "light" | "dark" | "auto";
    enabledPlaylistCategories: string[];
    proxyConfig: {
      protocol: "noProxy" | "http" | "socks5";
      server: string;
      port: number | null;
    };
    enableRealIP: boolean;
    realIP: string | null;
    shortcuts: {
      id: string;
      name: string;
      shortcut: string;
      globalShortcut: string;
    }[];
  };
  data: {
    user: Record<string, any>;
    likedSongPlaylistID: number;
    lastRefreshCookieDate: number;
    loginMode: string | null;
  };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
  updatePersistStoreSettings: (
    PartialSettings: Partial<PersistStoreInitialState["settings"]>
  ) => void;
}
