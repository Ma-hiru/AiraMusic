import { Log } from "@mahiru/ui/common/constants/dev";
import { create, StateCreator, StoreApi, UseBoundStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist, type PersistOptions } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

type CreateStoreOptions<T> = {
  name?: string;
  persist?: boolean;
  version?: number;
  partialize?: PersistOptions<T>["partialize"];
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
  const { name, persist: shouldPersist = false, version = 1, partialize, migrate } = options;

  const immerInitializer = immer(initializer);
  if (!shouldPersist) return create<T>()(immerInitializer);

  if (!name) Log.throw("name is required for persist store");
  const persistInitializer = persist(immerInitializer, {
    name: name!,
    version,
    migrate,
    partialize,
    storage: createJSONStorage(() => localStorage)
  });

  return create<T>()(persistInitializer);
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
