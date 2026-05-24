import { createZustandInitializer } from "@mahiru/ui/common/lib/store";
import { type NeteaseSettingsModel } from "@mahiru/ui/common/source/netease/models";
import { defaultSettings } from "@mahiru/ui/common/source/netease/models/NeteaseSettings";

export const SettingsStoreInitializer = createZustandInitializer<SettingsStoreType>((set) => {
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
