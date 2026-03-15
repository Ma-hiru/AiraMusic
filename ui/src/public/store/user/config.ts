import { createZustandConfig } from "@mahiru/ui/public/utils/store";
import { NeteaseSettingsModel, NeteaseUserModel } from "@mahiru/ui/public/models/netease";

export const UserStoreConfig = createZustandConfig((set, get): UserStoreType => {
  return {
    _user: null,
    _settings: null,
    updateUser(user) {
      set((draft) => {
        draft._user = user;
      });
    },
    updateSettings(settings) {
      set((draft) => {
        draft._settings = settings;
      });
    }
  };
});

export type UserStoreType = {
  _user: Nullable<NeteaseUserModel>;
  _settings: Nullable<NeteaseSettingsModel>;
  updateUser(user: Nullable<NeteaseUserModel>): void;
  updateSettings(settings: Nullable<NeteaseSettingsModel>): void;
};
