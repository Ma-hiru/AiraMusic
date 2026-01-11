import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { EqError, isRelease, Log } from "@mahiru/ui/public/utils/dev";

export function createZustandStore<T extends ZustandConfig<any>>(
  config: T,
  name: string,
  isPersist: boolean | NormalFunc<never[], boolean> = isRelease,
  currentVersion: number = 1,
  migrate?: PromiseFunc<[persistedState: unknown, version: number, currentVersion: number], unknown>
) {
  if (typeof isPersist === "function") {
    isPersist = isPersist();
  }

  const middleware = immer(
    isPersist
      ? persist(config as any, {
          name,
          storage: createJSONStorage(() => localStorage),
          version: currentVersion,
          migrate: async (persistedState, version) => {
            try {
              if (migrate) {
                return migrate(persistedState, version, currentVersion);
              }
            } catch (e) {
              Log.error(
                new EqError({
                  label: "ui/create.ts:createZustandStore",
                  message: "persist migrate error",
                  raw: e
                })
              );
            }
            return persistedState;
          }
        })
      : (config as any)
  );

  return create<ReturnType<T>>()(middleware as any);
}

interface useZustandShallowStoreFunc<StoreType> {
  <T extends (keyof StoreType)[]>(select: T): Pick<StoreType, T[number]>;
  (): StoreType;
}

export function createZustandShallowStore<StoreType>(
  useStore: ReturnType<typeof createZustandStore>
) {
  return (<T extends (keyof StoreType)[]>(select?: T) => {
    return useStore(
      useShallow((state: StoreType) => {
        if (!select || select.length === 0) {
          return state;
        }
        return select.reduce(
          (result, key: T[number]) => {
            result[key] = state[key];
            return result;
          },
          {} as Pick<StoreType, T[number]>
        );
      })
    );
  }) as useZustandShallowStoreFunc<StoreType>;
}
