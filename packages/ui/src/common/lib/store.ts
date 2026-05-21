import { Log } from "@mahiru/ui/common/constants/dev";
import { create, type Mutate, type StateCreator, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist, type PersistOptions } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

type PersistedUseStore<T extends object, PersistedState = T> = UseBoundStore<
  Mutate<StoreApi<T>, [["zustand/persist", PersistedState]]>
>;

const syncedStores = new WeakSet<object>();

function withLocalStoragePersistSync<T extends object>(useStore: PersistedUseStore<T>) {
  if (syncedStores.has(useStore)) return;
  syncedStores.add(useStore);
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
      syncedStores.delete(useStore);
    });
  }
}

type CreateStoreOptions<T> = {
  name?: string;
  persist?: boolean;
  version?: number;
  migrate?: PersistOptions<T>["migrate"];
};

export function createZustandInitializer<T extends object>(
  initializer: StateCreator<T, [["zustand/immer", never]]>
) {
  return initializer;
}

export function createZustandStore<T extends object>(
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
  withLocalStoragePersistSync(useStore);
  return useStore;
}

export function createStoreSelectors<T extends object>(useStore: UseBoundStore<StoreApi<T>>) {
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
