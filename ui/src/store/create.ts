import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { isRelease } from "@mahiru/ui/utils/dev";
import { EqError } from "@mahiru/ui/utils/err";
import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { Log } from "@mahiru/ui/utils/log";

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
