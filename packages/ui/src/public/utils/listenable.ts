import { Log } from "@mahiru/ui/public/utils/dev";

export abstract class Listenable {
  private readonly listeners = new Map<NormalFunc, { id: string; once: boolean }>();
  private listenerTimer: Nullable<number> = null;
  private updateMode: "async" | "sync" = "async";
  private updateGap = 100;

  protected executeListeners(mode = this.updateMode) {
    if (mode === "sync") {
      for (const [listener, { once }] of this.listeners) {
        try {
          listener();
          once && this.listeners.delete(listener);
        } catch (err) {
          Log.error(err);
          this.listeners.delete(listener);
        }
      }
      return;
    }

    this.listenerTimer && window.clearTimeout(this.listenerTimer);
    this.listenerTimer = window.setTimeout(() => {
      for (const [listener, { once }] of this.listeners) {
        requestAnimationFrame(() => {
          try {
            listener();
            once && this.listeners.delete(listener);
          } catch (err) {
            Log.error(err);
            this.listeners.delete(listener);
          }
        });
      }
    }, this.updateGap);
  }

  protected clearAllListeners() {
    this.listeners.clear();
  }

  setUpdateGap(ms: number) {
    this.updateGap = Number.isFinite(ms) ? Math.max(Math.floor(ms), 0) : 100;
  }

  setUpdateMode(mode: typeof this.updateMode) {
    this.updateMode = mode;
  }

  addListener(callback: NormalFunc, props: { once?: boolean; id?: string } = {}) {
    props.once ??= false;
    props.id ??= window.crypto.randomUUID();
    this.listeners.set(callback, { id: props.id, once: props.once });

    const unsubscriber = () => {
      this.listeners.delete(callback);
    };
    unsubscriber.id = props.id;

    return unsubscriber;
  }

  removeListener(callback: NormalFunc | string) {
    if (typeof callback === "string") {
      for (const [listener, { id }] of this.listeners) {
        if (id === callback) {
          this.listeners.delete(listener);
          break;
        }
      }
      return;
    }
    this.listeners.delete(callback);
  }

  afterUpdate<T extends Undefinable<NormalFunc> = undefined>(
    cb?: T
  ): T extends Falsy ? Promise<void> : void {
    if (!cb) {
      const { promise, resolve } = Promise.withResolvers<void>();
      const listener = () => {
        this.removeListener(listener);
        resolve();
      };
      this.addListener(listener);
      this.executeListeners();
      return promise as T extends Falsy ? Promise<void> : void;
    }

    const listener = () => {
      this.removeListener(listener);
      cb();
    };
    this.addListener(listener);
    this.executeListeners();

    return undefined as T extends Falsy ? Promise<void> : void;
  }

  [Symbol.dispose]() {
    this.listeners.clear();
  }
}

export class Listener extends Listenable {
  execute() {
    super.executeListeners();
  }

  clear() {
    super.clearAllListeners();
  }

  add(callback: NormalFunc, props?: { once?: boolean; id?: string }) {
    return super.addListener(callback, props);
  }

  remove(callback: NormalFunc | string) {
    super.removeListener(callback);
  }
}
