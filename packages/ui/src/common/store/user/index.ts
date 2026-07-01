import { useMemo } from "react";
import { NeteaseUser } from "@/common/netease/models";
import { RendererZustandStoreCreator } from "@/common/lib/store";

import { type UserStoreType, UserStoreInitializer } from "./config";

export const useUserStore = RendererZustandStoreCreator.createZustandStore<UserStoreType>(
  UserStoreInitializer,
  {
    name: "user",
    version: 1,
    persist: true
  }
);

export const useUserStorePick =
  RendererZustandStoreCreator.createStoreSelectors<UserStoreType>(useUserStore);

export const userStoreSnapshot = useUserStore.getState.bind(useUserStore);

export function useUser() {
  const { _user } = useUserStorePick(["_user"]);
  return useMemo(() => NeteaseUser.fromObject(_user), [_user]);
}

export type { UserStoreType } from "./config";
