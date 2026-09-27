import { AsyncLocalStorage } from "node:async_hooks";

export function createCtxRunning<Ctx extends object>(
  defaultCtx?: Partial<Ctx>,
  handleCtx?: (
    ctx: Partial<Ctx>,
    defaultCtx?: Partial<Ctx>,
    parentCtx?: Partial<Ctx>
  ) => Partial<Ctx>
) {
  const AsyncStorage = new AsyncLocalStorage<Partial<Ctx>>();
  return {
    runWithContext<T>(context: Partial<Ctx>, callback: () => T): T {
      const parent = AsyncStorage.getStore();

      return AsyncStorage.run(
        handleCtx
          ? handleCtx(context, defaultCtx, parent)
          : {
              ...defaultCtx,
              ...parent,
              ...context
            },
        callback
      );
    },

    AsyncStorage
  };
}
