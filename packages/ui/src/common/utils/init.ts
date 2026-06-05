import { Log } from "@/common/lib/log";

interface CanInit {
  _init(): void | Promise<void>;
}

type InitClass<T extends AnyClass = AnyClass> = T &
  CanInit & {
    readonly [INIT_MARK]: true;
  };

const INIT_MARK = Symbol("INIT_MARK");

export function Init(cb: NormalFunc) {
  return function <T extends AnyClass>(_: T, context: ClassDecoratorContext<T>) {
    context.addInitializer(function () {
      Object.defineProperties(this, {
        [INIT_MARK]: {
          value: true,
          writable: false,
          enumerable: false,
          configurable: false
        },
        _init: {
          value: function () {
            cb();
          },
          writable: false,
          enumerable: false,
          configurable: true
        }
      });
    });
  };
}

export function ensureInitClass<T extends AnyClass>(cls: T): InitClass<T> {
  if (!(INIT_MARK in cls)) {
    throw new Error("Class must be decorated with @Init");
  }
  return cls as InitClass<T>;
}

export function initAsync(object: CanInit | InitClass) {
  const init = wrap(() => object._init());
  if (queueMicrotask == null) {
    setTimeout(init, 0);
    return;
  }
  queueMicrotask(init);
}

export function initSync(object: CanInit | InitClass) {
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
