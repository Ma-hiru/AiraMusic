import { useMemo } from "react";
import { UserStoreInitializer, type UserStoreType } from "./config";
import { createStoreSelectors, createZustandStore } from "@mahiru/ui/common/lib/store";
import { NeteaseUser } from "@mahiru/ui/common/source/netease/models";

export const useUserStore = createZustandStore<UserStoreType>(UserStoreInitializer, {
  name: "user",
  version: 1,
  persist: true
});

export const useUserStorePick = createStoreSelectors<UserStoreType>(useUserStore);

export const userStoreSnapshot = useUserStore.getState.bind(useUserStore);

export function useUser() {
  const { _user } = useUserStorePick(["_user"]);
  return useMemo(() => NeteaseUser.fromObject(_user), [_user]);
}

export type { UserStoreType } from "./config";
