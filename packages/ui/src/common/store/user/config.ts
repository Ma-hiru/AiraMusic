import { createZustandInitializer } from "@mahiru/ui/common/lib/store";
import {
  type NeteaseSettingsModel,
  NeteaseUser,
  type NeteaseUserModel
} from "@mahiru/ui/common/source/netease/models";
import { defaultSettings } from "@mahiru/ui/common/source/netease/models/NeteaseSettings";

export const UserStoreInitializer = createZustandInitializer<UserStoreType>((set) => {
  return {
    _user: null,
    _settings: defaultSettings,
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
        draft._settings = settings;
      });
    }
  };
});

export type UserStoreType = {
  _user: Nullable<NeteaseUserModel>;
  _settings: NeteaseSettingsModel;
  isLoggedIn: () => boolean;
  updateUser(user: Optional<NeteaseUserModel>): void;
  updateSettings(settings: NeteaseSettingsModel): void;
};
