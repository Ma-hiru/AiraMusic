import { createZustandShallowStore, createZustandStore } from "../create";
import { UserStoreActions, UserStoreConfig, UserStoreInitialState } from "./config";

export type UserStoreType = UserStoreInitialState & UserStoreActions;

const userStore = createZustandStore(UserStoreConfig, "user", true);

export const useUserStore = createZustandShallowStore<UserStoreType>(userStore);

export const getUserStoreSnapshot = userStore.getState;
