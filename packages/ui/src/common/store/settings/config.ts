import { RendererZustandStoreCreator } from "@/common/lib/store";
import { defaultSettings } from "@/common/netease/models/netease-settings";
import type { NeteaseSettingsModel } from "@/common/netease/models";
import type { ShortcutBindingMap } from "@/common/constants/shortcut";

export const SettingsStoreInitializer =
  RendererZustandStoreCreator.createZustandInitializer<SettingsStoreType>((set) => {
    return {
      _settings: defaultSettings,
      updateSettings(settings) {
        set((draft) => {
          draft._settings = settings;
        });
      },
      updateShortcuts(shortcuts) {
        set((draft) => {
          draft._settings.shortcuts = shortcuts;
        });
      }
    };
  });

export type SettingsStoreType = {
  _settings: NeteaseSettingsModel;
  updateSettings(settings: NeteaseSettingsModel): void;
  updateShortcuts(shortcuts: ShortcutBindingMap): void;
};
