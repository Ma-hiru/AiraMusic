import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererRuntime } from "@/common/lib/runtime";
import { RendererWindow } from "@/common/lib/window";
import { initAsync } from "@/common/utils/init";

type OnceRecordCache = {
  id: string;
  record: string[];
};

export class RendererOnce {
  private static readonly cacheKey = "once-record";
  private static readonly cacheID = RendererWindow.currentWindowType + "_" + RendererRuntime.id;
  private static record = new Set<string>();

  static _init() {
    const cache = RendererCache.browser.getOne<OnceRecordCache>(RendererOnce.cacheKey);

    if (cache && cache.id === RendererOnce.cacheID) {
      this.record = new Set(cache.record);
    } else {
      this.record = new Set();
      RendererCache.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
        id: RendererOnce.cacheID,
        record: []
      });
    }
  }

  private static updateCache(id: string) {
    RendererOnce.record.add(id);
    queueMicrotask(() => {
      RendererCache.browser.setOne<OnceRecordCache>(RendererOnce.cacheKey, {
        id: RendererOnce.cacheID,
        record: [...RendererOnce.record]
      });
    });
  }

  static do(id: string, cb: NormalFunc) {
    if (RendererOnce.record.has(id)) return;
    try {
      cb();
      RendererOnce.updateCache(id);
    } catch (e) {
      Log.error({
        label: "once",
        message: "once error",
        raw: e
      });
    }
  }
}

initAsync(RendererOnce);
