import { UserStoreConfig, UserStoreType } from "./config";
import { createZustandShallowStore, createZustandStore } from "@mahiru/ui/public/utils/store";

const userStore = createZustandStore(UserStoreConfig, "user", true);

export const useUserStore = createZustandShallowStore<UserStoreType>(userStore);

export const userStoreSnapshot = userStore.getState.bind(userStore);

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
