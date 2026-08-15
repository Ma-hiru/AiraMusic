import { Log } from "@/common/lib/log";
import { LRUCacheWithTime } from "@/common/utils/lru";

export class PreloadManager<K> {
  private readonly name;
  private readonly delay;
  private readonly exec;
  private readonly preloadList;
  private readonly preloadedRecord = new Set<K>();

  constructor(props: {
    name: string;
    delay?: number;
    timeout?: number;
    capacity?: number;
    exec: PromiseFunc<[id: K, signal: AbortSignal]>;
  }) {
    const { exec, name, capacity = 3, delay = 1_000, timeout = 1000 * 60 } = props;
    this.name = name;
    this.delay = delay;
    this.exec = exec;
    this.preloadList = new LRUCacheWithTime<K, AbortController>(
      capacity,
      timeout,
      (_, controller) => controller.abort()
    );
  }

  private logger(...args: any[]) {
    Log.info(`PreloadManager<${this.name}>`, ...args);
  }

  private execPreload(id: K, signal: AbortSignal) {
    if (signal.aborted || this.preloadedRecord.has(id)) return;

    this.logger("preload", id);
    this.exec(id, signal)
      .then(() => {
        this.logger("preload success", id);
        this.preloadedRecord.add(id);
      })
      .catch((err) => this.logger("preload error", id, err))
      .finally(() => this.cancelPreload(id));
  }

  preload(id: K) {
    if (!!this.preloadList.get(id) || this.preloadedRecord.has(id)) return;

    const controller = new AbortController();
    this.preloadList.set(id, controller);

    const timer = window.setTimeout(() => this.execPreload(id, controller.signal), this.delay);
    controller.signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
  }

  cancelPreload(id: K) {
    if (this.preloadedRecord.has(id)) return;
    this.logger("cancel preload", id);
    this.preloadList.delete(id)?.abort();
  }
}
