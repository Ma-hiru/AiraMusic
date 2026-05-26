import { Log } from "@/common/lib/log";
import { CacheStore } from "@/common/store/cache";
import { RendererRuntime } from "@/common/lib/runtime";
import { RendererWindow } from "@/common/lib/window";
import Init from "@/common/utils/init";

type OnceRecordCache = {
  id: string;
  record: string[];
};

export class RendererOnce {
  private static readonly cacheKey = "once-record";
  private static readonly cacheID = RendererWindow.currentWindowType + "_" + RendererRuntime.id;
  private static record = new Set<string>();

  static _init() {
    const cache = CacheStore.browser.getOne<OnceRecordCache>(RendererOnce.cacheKey);

    if (cache && cache.id === RendererOnce.cacheID) {
      this.record = new Set(cache.record);
    } else {
      this.record = new Set();
      CacheStore.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
        id: RendererOnce.cacheID,
        record: []
      });
    }
  }

  private static updateCache(id: string) {
    RendererOnce.record.add(id);
    requestIdleCallback(() => {
      CacheStore.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
        id: RendererOnce.cacheID,
        record: [...RendererOnce.record]
      });
    });
  }

  static do(id: string, cb: NormalFunc) {
    if (RendererOnce.record.has(id)) return;
    RendererOnce.updateCache(id);
    try {
      cb();
    } catch (e) {
      Log.error({
        label: "once",
        message: "once error",
        raw: e
      });
    }
  }
}

Init.initMicrotask(RendererOnce);
