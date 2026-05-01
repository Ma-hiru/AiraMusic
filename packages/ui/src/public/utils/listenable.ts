import { Log } from "@mahiru/ui/public/utils/dev";

export abstract class Listenable<EventName = string> {
  private readonly listenableName;
  private readonly listeners = new Map<NormalFunc, { id: string; once: boolean }>();
  private readonly eventListeners = new Map<
    EventName,
    Map<NormalFunc, { id: string; once: boolean }>
  >();
  private listenerTimer: Nullable<number> = null;
  private listenerMicrotaskPending = false;
  private updateMode: "microtask" | "sync" | "debounce" = "debounce";
  private updateGap = 100; // ms

  constructor(name?: string) {
    this.listenableName = name;
  }

  private flushListeners(event?: EventName) {
    const execute = (listeners: typeof this.listeners) => {
      for (const [listener, options] of [...listeners.entries()]) {
        options.once && listeners.delete(listener);
        this.wrapListener(listener)();
      }
    };
    const eventListeners = event && this.eventListeners.get(event);
    eventListeners && execute(eventListeners);
    execute(this.listeners);
  }

  protected wrapListener(
    listener: NormalFunc,
    label = this.listenableName || "Listenable",
    message = `Executing ${label} listener error`
  ) {
    return () => {
      try {
        return listener();
      } catch (raw) {
        Log.error({ message, label, raw });
      }
    };
  }

  protected executeListeners(event?: EventName, mode = this.updateMode) {
    switch (mode) {
      case "sync":
        return this.flushListeners(event);
      case "microtask":
        if (this.listenerMicrotaskPending) return;
        this.listenerMicrotaskPending = true;
        return queueMicrotask(() => {
          this.listenerMicrotaskPending = false;
          this.flushListeners(event);
        });
      case "debounce":
        this.listenerTimer && window.clearTimeout(this.listenerTimer);
        this.listenerTimer = window.setTimeout(() => {
          this.listenerTimer = null;
          this.flushListeners(event);
        }, this.updateGap);
        return;
    }
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

  addEventListener(
    event: EventName,
    callback: NormalFunc,
    props: { once?: boolean; id?: string } = {}
  ) {
    props.once ??= false;
    props.id ??= window.crypto.randomUUID();
    const listeners = this.eventListeners.get(event) ?? new Map();
    listeners.set(callback, { id: props.id, once: props.once });
    this.eventListeners.set(event, listeners);

    const unsubscriber = () => {
      this.eventListeners.get(event)?.delete(callback);
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

  removeEventListener(event: EventName, callback: NormalFunc | string) {
    if (typeof callback === "string") {
      for (const [listener, { id }] of this.eventListeners.get(event) ?? []) {
        if (id === callback) {
          this.eventListeners.get(event)?.delete(listener);
          break;
        }
      }
      return;
    }
    this.eventListeners.get(event)?.delete(callback);
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
