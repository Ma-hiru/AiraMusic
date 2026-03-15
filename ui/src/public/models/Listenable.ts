import { Log } from "@mahiru/ui/public/utils/dev";

export abstract class Listenable {
  private listeners = new Set<NormalFunc>();
  private listenerTimer: Nullable<number> = null;

  protected executeListeners() {
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
    }, 100);
  }

  protected clearAllListeners() {
    this.listeners.clear();
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
