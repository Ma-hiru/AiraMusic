import { UserStoreConfig, UserStoreType } from "./config";
import { createZustandShallowStore, createZustandStore } from "@mahiru/ui/public/utils/store";
import { useMemo } from "react";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";

const userStore = createZustandStore(UserStoreConfig, "user", true);

export const useUserStore = createZustandShallowStore<UserStoreType>(userStore);

export const userStoreSnapshot = userStore.getState.bind(userStore);

export function useUser() {
  const { _user } = useUserStore();
  return useMemo(() => NeteaseUser.fromObject(_user), [_user]);
}

export function AddUserStore(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "userStore", {
      get() {
        return userStoreSnapshot();
      }
    });
  });
}

export interface WithUserStore {
  readonly userStore: UserStoreType;
}

export type { UserStoreType } from "./config";
