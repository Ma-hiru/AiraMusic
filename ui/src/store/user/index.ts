import { createZustandShallowStore, createZustandStore } from "../create";
import { UserStoreActions, UserStoreConfig, UserStoreInitialState } from "./config";

const userStore = createZustandStore(UserStoreConfig, "user", true);

export const useUserStore = createZustandShallowStore<UserStoreType>(userStore);

export function UserStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "userSnapshot", {
      get() {
        return userStore.getState();
      }
    });
  });
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "isChangeDay", {
      get() {
        const lastDate = userStore.getState().UserLastRefreshCookieDate;
        return typeof lastDate !== "number" || lastDate !== new Date().getDate();
      }
    });
  });
}

export type UserStoreType = UserStoreInitialState & UserStoreActions;

export interface WithUserSnapshot {
  readonly userSnapshot: UserStoreType;
  readonly isChangeDay: boolean;
}
