import { createZustandShallowStore, createZustandStore } from "../create";
import { SettingsStoreActions, SettingsStoreConfig, SettingsStoreInitialState } from "./config";

const settingsStore = createZustandStore(SettingsStoreConfig, "settings", true);

export const useSettingsStore = createZustandShallowStore<SettingsStoreType>(settingsStore);

export function SettingsStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "settingsSnapshot", {
      get() {
        return settingsStore.getState();
      }
    });
  });
}

export type SettingsStoreType = SettingsStoreInitialState & SettingsStoreActions;

export interface WithSettingsSnapshot {
  readonly settingsSnapshot: SettingsStoreType;
}
