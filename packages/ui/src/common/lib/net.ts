import { EqError } from "@mahiru/log";
import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { Listener } from "@/common/utils/listenable";
import type { NetFetchRequest } from "@mahiru/ipc/types";

export class RendererNet {
  static completed: number[] = [];
  static cursor = 0;
  static listener = new Listener();

  static get quality() {
    const now = performance.now();
    while (this.cursor < this.completed.length && this.completed[this.cursor]! < now - 1000) {
      this.cursor++;
    }
    const recent = this.completed.length - this.cursor;
    const score = Math.min(1, recent / 12);
    return {
      score,
      recent
    };
  }

  static get status(): Promise<NetworkStatus> {
    if (!window.navigator.onLine) return Promise.resolve("offline");
    return Promise.resolve(RendererIPC.NormalChannel.send("invoke_device_net", undefined));
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

  static async requestFromNode(
    input: URL | string | Request,
    init?: RequestInit
  ): Promise<Response> {
    const request = new Request(input instanceof URL ? input.href : input, init);
    request.signal.throwIfAborted();
    const headers = new Headers(request.headers);
    // 浏览器的 Request 会过滤 Referer 等受限请求头；Node 请求需要保留显式传入的值。
    new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).forEach(
      (value, key) => headers.set(key, value)
    );
    const payload: NetFetchRequest = {
      input: request.url,
      init: {
        method: request.method,
        headers: Object.fromEntries(headers),
        cache: request.cache,
        credentials: request.credentials,
        integrity: request.integrity,
        keepalive: request.keepalive,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        ...(request.body === null ? {} : { body: await request.arrayBuffer() })
      }
    };
    request.signal.throwIfAborted();
    const result = await RendererIPC.NormalChannel.send("invoke_net_fetch", payload);
    request.signal.throwIfAborted();
    const response = new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers
    });
    Object.defineProperties(response, {
      url: { value: result.url },
      redirected: { value: result.redirected },
      type: { value: result.type }
    });
    return response;
  }

  static {
    queueMicrotask(() => {
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

        Log.info("AppNet", "network status changed", this.isOnline ? "online" : "offline");
      };
      Log.info("AppNet", "network status changed", window.navigator.onLine ? "online" : "offline");
      window.addEventListener("online", status, { passive: true });
      window.addEventListener("offline", status, { passive: true });
    });
  }
}
