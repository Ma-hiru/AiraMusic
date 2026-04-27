import { Log } from "@mahiru/ui/public/utils/dev";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import _AppWindow from "./window";
import Init from "@mahiru/ui/public/utils/init";

type OnceRecordCache = {
  id: string;
  record: string[];
};

export default class _AppOnce {
  private static readonly cacheKey = "once-record";
  private static readonly cacheID = _AppWindow.currentWindowType + "_" + _AppWindow.runtimeID;
  private static record = new Set<string>();

  static _init() {
    const cache = CacheStore.browser.getOne<OnceRecordCache>(_AppOnce.cacheKey);

    if (cache && cache.id === _AppOnce.cacheID) {
      this.record = new Set(cache.record);
    } else {
      this.record = new Set();
      CacheStore.browser.setOne<OnceRecordCache>(_AppOnce.cacheKey, {
        id: _AppOnce.cacheID,
        record: []
      });
    }
  }

  private static updateCache(id: string) {
    _AppOnce.record.add(id);
    requestIdleCallback(() => {
      CacheStore.browser.setOne<OnceRecordCache>(_AppOnce.cacheKey, {
        id: _AppOnce.cacheID,
        record: [..._AppOnce.record]
      });
    });
  }

  static do(id: string, cb: NormalFunc) {
    if (_AppOnce.record.has(id)) return;
    _AppOnce.updateCache(id);
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

Init.initMicrotask(_AppOnce);
