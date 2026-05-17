import { useMemo } from "react";
import { UserStoreInitializer, UserStoreType } from "./config";
import { createStoreSelectors, createZustandStore } from "@mahiru/ui/common/lib/store";
import { NeteaseSettings, NeteaseUser } from "@mahiru/ui/common/source/netease/models";

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

export function useSettings() {
  const { _settings } = useUserStorePick(["_settings"]);
  return useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);
}

export type { UserStoreType } from "./config";
