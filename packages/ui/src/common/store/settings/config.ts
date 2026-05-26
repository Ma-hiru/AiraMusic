import { RendererZustandStoreCreator } from "@/common/lib/store";
import { defaultSettings } from "@/common/netease/models/netease-settings";
import { type NeteaseSettingsModel } from "@/common/netease/models";

export const SettingsStoreInitializer =
  RendererZustandStoreCreator.createZustandInitializer<SettingsStoreType>((set) => {
    return {
      _settings: defaultSettings,
      updateSettings(settings) {
        set((draft) => {
          draft._settings = settings;
        });
      }
    };
  });

export type SettingsStoreType = {
  _settings: NeteaseSettingsModel;
  updateSettings(settings: NeteaseSettingsModel): void;
};
