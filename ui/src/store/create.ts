import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { isRelease } from "@mahiru/ui/utils/dev";
import { EqError } from "@mahiru/ui/utils/err";

export function createZustandStore<T extends ZustandConfig<any>>(
  config: T,
  name: string,
  isPersist: boolean | NormalFunc<never[], boolean> = isRelease,
  currentVersion: number = 1,
  migrate?: NormalFunc<
    [persistedState: unknown, version: number, currentVersion: number],
    Promise<unknown>
  >
) {
  if (typeof isPersist === "function") {
    isPersist = isPersist();
  }

  const middleware = immer(
    isPersist
      ? persist(config, {
          name,
          storage: createJSONStorage(() => localStorage),
          version: currentVersion,
          migrate: async (persistedState, version) => {
            try {
              if (migrate) {
                return migrate(persistedState, version, currentVersion);
              }
            } catch (e) {
              EqError.printErrorDEV("[zustand]", "persist migrate error:", e);
            }
            return persistedState;
          }
        })
      : config
  );

  return create<ReturnType<T>>()(middleware);
}

export function createZustandShallowStore<StoreType>(
  useStore: ReturnType<typeof createZustandStore>
) {
  return function useZustandShallowStore<T extends (keyof StoreType)[]>(select: T) {
    return useStore(
      useShallow((state) =>
        select.reduce(
          (result, key: T[number]) => {
            result[key] = state[key];
            return result;
          },
          {} as Pick<StoreType, T[number]>
        )
      )
    );
  };
}
