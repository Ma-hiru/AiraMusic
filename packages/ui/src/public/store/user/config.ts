import { createZustandConfig } from "@mahiru/ui/public/utils/store";
import {
  NeteaseSettingsModel,
  NeteaseUser,
  NeteaseUserModel
} from "@mahiru/ui/public/source/netease/models";

export const UserStoreConfig = createZustandConfig((set): UserStoreType => {
  return {
    _user: null,
    _settings: null,
    isLoggedIn: () => {
      return NeteaseUser.isLoggedIn;
    },
    updateUser(user) {
      set((draft) => {
        draft._user = user ?? null;
      });
    },
    updateSettings(settings) {
      set((draft) => {
        draft._settings = settings ?? null;
      });
    }
  };
});

export type UserStoreType = {
  _user: Nullable<NeteaseUserModel>;
  _settings: Nullable<NeteaseSettingsModel>;
  isLoggedIn: () => boolean;
  updateUser(user: Optional<NeteaseUserModel>): void;
  updateSettings(settings: Optional<NeteaseSettingsModel>): void;
};
