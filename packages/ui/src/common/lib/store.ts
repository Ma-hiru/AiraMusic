import { create, type Mutate, type StateCreator, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist, type PersistOptions } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import { Log } from "@/common/lib/log";

type PersistedUseStore<T extends object, PersistedState = T> = UseBoundStore<
  Mutate<StoreApi<T>, [["zustand/persist", PersistedState]]>
>;

type CreateStoreOptions<T> = {
  name?: string;
  persist?: boolean;
  version?: number;
  migrate?: PersistOptions<T>["migrate"];
};

export class RendererZustandStoreCreator {
  private static syncedStores = new WeakSet<object>();

  private static withLocalStoragePersistSync<T extends object>(useStore: PersistedUseStore<T>) {
    if (this.syncedStores.has(useStore)) return;
    this.syncedStores.add(useStore);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== useStore.persist.getOptions().name) return;
      if (event.oldValue === event.newValue) return;
      useStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    // 当模块热更新时，移除事件监听器并从已同步的存储集合中删除，以避免内存泄漏和重复监听
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.removeEventListener("storage", onStorage);
        this.syncedStores.delete(useStore);
      });
    }
  }

  static createZustandInitializer<T extends object>(
    initializer: StateCreator<T, [["zustand/immer", never]]>
  ) {
    return initializer;
  }

  static createZustandStore<T extends object>(
    initializer: StateCreator<T, [["zustand/immer", never]]>,
    options: CreateStoreOptions<T> = {}
  ) {
    const { name, persist: shouldPersist = false, version = 1, migrate } = options;

    const immerInitializer = immer(initializer);
    if (!shouldPersist) return create<T>()(immerInitializer);

    if (!name) Log.throw("name is required for persist store");
    const persistInitializer = persist(immerInitializer, {
      name: name!,
      version,
      migrate,
      storage: createJSONStorage(() => localStorage)
    });
    const useStore = create<T>()(persistInitializer) as PersistedUseStore<T>;
    this.withLocalStoragePersistSync(useStore);
    return useStore;
  }

  static createStoreSelectors<T extends object>(useStore: UseBoundStore<StoreApi<T>>) {
    return function usePick<K extends keyof T>(keys: readonly K[]): Pick<T, K> {
      return useStore(
        useShallow((state) => {
          const picked = {} as Pick<T, K>;
          for (const key of keys) picked[key] = state[key];
          return picked;
        })
      );
    };
  }
}
