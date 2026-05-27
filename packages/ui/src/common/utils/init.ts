import { Log } from "@/common/lib/log";

export interface CanInit {
  _init(): void | Promise<void>;
}

export function initAsync(object: CanInit) {
  const init = wrap(() => object._init());
  if (queueMicrotask == null) {
    setTimeout(init, 0);
    return;
  }
  queueMicrotask(init);
}

export function initSync(object: CanInit) {
  wrap(() => object._init())();
}

function wrap(init: NormalFunc) {
  return () => {
    try {
      init();
    } catch (err) {
      Log.error("init", err);
    }
  };
}
