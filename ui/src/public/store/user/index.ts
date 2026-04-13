import { UserStoreConfig, UserStoreType } from "./config";
import { createZustandShallowStore, createZustandStore } from "@mahiru/ui/public/utils/store";
import { useMemo } from "react";
import { NeteaseSettings, NeteaseUser } from "@mahiru/ui/public/source/netease/models";

const userStore = createZustandStore(UserStoreConfig, "user", true);

export const useUserStore = createZustandShallowStore<UserStoreType>(userStore);

export const userStoreSnapshot = userStore.getState.bind(userStore);

export function useUser() {
  const { _user } = useUserStore();
  return useMemo(() => NeteaseUser.fromObject(_user), [_user]);
}

export function useSettings() {
  const { _settings } = useUserStore();
  return useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);
}

export type { UserStoreType } from "./config";
