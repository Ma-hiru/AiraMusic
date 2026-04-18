import { Log } from "@mahiru/ui/public/utils/dev";
import { Listener } from "@mahiru/ui/public/utils/listenable";
import _AppRenderer from "./renderer";
import { EqError } from "@mahiru/log/src/err";

export default class _AppNet {
  static completed: number[] = [];
  static cursor = 0;
  static listener = new Listener();

  static init() {
    const observer = new PerformanceObserver((list) => {
      const now = performance.now();
      list.getEntries().forEach(() => {
        this.completed.push(now);
      });
      if (this.completed.length > 5000) {
        this.completed = this.completed.slice(this.cursor);
        this.cursor = 0;
      }
    });
    observer.observe({
      entryTypes: ["resource"],
      buffered: false
    });
    const status = () => {
      if (!this.isOnline) this.listener.execute();
      else {
        // 有时候网络状态会在短时间内频繁变化，等 5 秒再通知，避免重复请求
        window.setTimeout(() => {
          this.listener.execute();
        }, 5000);
      }

      Log.info("Network status", this.isOnline ? "online" : "offline");
    };
    Log.info("Network status", window.navigator.onLine ? "online" : "offline");
    window.addEventListener("online", status, { passive: true });
    window.addEventListener("offline", status, {
      passive: true
    });
  }

  static get quality() {
    const now = performance.now();
    while (this.cursor < this.completed.length && this.completed[this.cursor]! < now - 1000) {
      this.cursor++;
    }
    const recent = this.completed.length - this.cursor;
    const score = Math.min(1, recent / 12);
    Log.debug("Network quality", "score", score, "recent", recent);
    return {
      score,
      recent
    };
  }

  static get status(): Promise<NetworkStatus> {
    if (!window.navigator.onLine) return Promise.resolve("offline");
    return Promise.resolve(_AppRenderer.Event.invoke.checkOnlineStatus());
  }

  static get isOnline() {
    return window.navigator.onLine;
  }

  static autoRetryRequest<T>(
    request: PromiseFunc<[], T>,
    callback: NormalFunc<[ok: true, data: T] | [ok: false, err: unknown]>,
    skip?: NormalFunc<[], boolean>
  ) {
    const req = () => {
      const s = skip && skip();
      Log.debug("autoRetryRequest", "auto retry, skip: ", s ? "yes" : "no");
      if (s) return;
      if (!this.isOnline) {
        callback(
          false,
          new EqError({
            message: "网络错误，请检查网络"
          })
        );
      } else {
        request()
          .then((data) => {
            callback(true, data);
          })
          .catch((err) => {
            callback(false, err);
          });
      }
    };
    if (!skip || !skip()) req();
    return this.onOnlineChange(req);
  }

  static removeAutoRetry(id: string) {
    return this.offOnlineChange(id);
  }

  static onOnlineChange = this.listener.add.bind(this.listener);

  static offOnlineChange = this.listener.remove.bind(this.listener);
}

window.queueMicrotask(() => {
  _AppNet.init();
});
