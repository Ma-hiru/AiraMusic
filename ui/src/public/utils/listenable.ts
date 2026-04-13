import { Log } from "@mahiru/ui/public/utils/dev";

export abstract class Listenable {
  private readonly listeners = new Set<NormalFunc>();
  private listenerTimer: Nullable<number> = null;
  private updateMode: "async" | "sync" = "async";
  private updateGap = 100;

  protected executeListeners(mode = this.updateMode) {
    if (mode === "sync") {
      for (const listener of this.listeners) {
        try {
          listener();
        } catch (err) {
          Log.error(err);
          this.listeners.delete(listener);
        }
      }
      return;
    }

    this.listenerTimer && window.clearTimeout(this.listenerTimer);
    this.listenerTimer = window.setTimeout(() => {
      for (const listener of this.listeners) {
        requestAnimationFrame(() => {
          try {
            listener();
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

  addListener(callback: NormalFunc) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  removeListener(callback: NormalFunc) {
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

  add(callback: NormalFunc) {
    return super.addListener(callback);
  }

  remove(callback: NormalFunc) {
    super.removeListener(callback);
  }
}
