import { createZustandInitializer } from "@mahiru/ui/common/lib/store";
import { NeteaseUser, type NeteaseUserModel } from "@mahiru/ui/common/source/netease/models";

export const UserStoreInitializer = createZustandInitializer<UserStoreType>((set) => {
  return {
    _user: null,
    isLoggedIn: () => {
      return NeteaseUser.isLoggedIn;
    },
    updateUser(user) {
      set((draft) => {
        draft._user = user ?? null;
      });
    }
  };
});

export type UserStoreType = {
  _user: Nullable<NeteaseUserModel>;
  isLoggedIn: () => boolean;
  updateUser(user: Optional<NeteaseUserModel>): void;
};
