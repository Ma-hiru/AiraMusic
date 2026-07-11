import { RendererZustandStoreCreator } from "@/common/lib/store";
import { NeteaseUser, type NeteaseUserModel } from "@/common/netease/models";

export const UserStoreInitializer =
  RendererZustandStoreCreator.createZustandInitializer<UserStoreType>((set) => {
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
  isLoggedIn: () => boolean;
  _user: Nullable<NeteaseUserModel>;
  updateUser(user: Optional<NeteaseUserModel>): void;
};
