import { LayoutStoreSnapshot, WithLayoutSnapshot } from "@mahiru/ui/store/layout";
import { PlayerStoreSnapshot, WithPlayerSnapshot } from "@mahiru/ui/store/player";
import { UserStoreSnapshot, WithUserSnapshot } from "@mahiru/ui/store/user";
import { SettingsStoreSnapshot, WithSettingsSnapshot } from "@mahiru/ui/store/settings";
import { CacheStoreClass } from "@mahiru/ui/store/cache";

const cacheStoreInstance = new CacheStoreClass();

export function CacheStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "cacheStore", {
      get() {
        return cacheStoreInstance;
      }
    });
  });
}

export interface WithCacheSnapshot {
  readonly cacheStore: CacheStoreClass;
}

export function AddStoreSnapshot(value: Function, ctx: ClassDecoratorContext) {
  LayoutStoreSnapshot(value, ctx);
  PlayerStoreSnapshot(value, ctx);
  UserStoreSnapshot(value, ctx);
  CacheStoreSnapshot(value, ctx);
  SettingsStoreSnapshot(value, ctx);
}

export interface WithStoreSnapshot
  extends
    WithLayoutSnapshot,
    WithUserSnapshot,
    WithSettingsSnapshot,
    WithPlayerSnapshot,
    WithCacheSnapshot {}
