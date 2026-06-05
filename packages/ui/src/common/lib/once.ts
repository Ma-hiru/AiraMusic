import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererRuntime } from "@/common/lib/runtime";
import { ensureInitClass, Init, initAsync } from "@/common/utils/init";

type OnceRecordCache = {
  id: string;
  record: string[];
};

const { promise, resolve } = Promise.withResolvers<void>();

@Init(() => {
  const cache = RendererCache.browser.getOne<OnceRecordCache>(RendererOnce.cacheKey);
  if (cache && cache.id === RendererOnce.cacheID) {
    RendererOnce.record = new Set(cache.record);
  } else {
    RendererOnce.record = new Set();
    RendererCache.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
      id: RendererOnce.cacheID,
      record: []
    });
  }
  RendererOnce.setReady();
})
export class RendererOnce {
  private static readonly cacheKey = "once-record";
  private static readonly cacheID = RendererRuntime.currentWindowType + "_" + RendererRuntime.id;
  private static record = new Set<string>();
  private static setReady = resolve;
  private static ready = promise;

  private static updateCache(id: string) {
    RendererOnce.record.add(id);
    queueMicrotask(() => {
      RendererCache.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
        id: RendererOnce.cacheID,
        record: [...RendererOnce.record]
      });
    });
  }

  static do(id: string, cb: NormalFunc | PromiseFunc) {
    RendererOnce.ready.then(async () => {
      if (RendererOnce.record.has(id)) return;
      try {
        // 使用await
        // 避免当cb返回promise时，出现cb执行失败却仍然执行了同步代码中的缓存更新
        await cb();
        RendererOnce.updateCache(id);
      } catch (e) {
        Log.error({
          label: "once",
          message: "once error",
          raw: e
        });
      }
    });
  }
}

initAsync(ensureInitClass(RendererOnce));
