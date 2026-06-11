import { Log } from "@/common/lib/log";

const INIT_MARK = Symbol("INIT_MARK");

interface CanInit {
  __init(): void | Promise<void>;
}

type InitObject = CanInit & {
  readonly [INIT_MARK]: true;
};

function wrap(init: NormalFunc) {
  return () => {
    try {
      init();
    } catch (err) {
      Log.error("init", err);
    }
  };
}

/**
 * 自动在对象上生成 `__init` 方法，方法调用装饰器工厂捕获的闭包
 * */
function Init(cb: NormalFunc) {
  return function <T extends AnyClass>(_: T, context: ClassDecoratorContext<T>) {
    context.addInitializer(function () {
      Object.defineProperties(this, {
        [INIT_MARK]: {
          value: true,
          writable: false,
          enumerable: false,
          configurable: false
        },
        __init: {
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

function ensureInitObject<T extends object>(object: T): InitObject {
  if (!(INIT_MARK in object)) {
    throw new Error("Class must be decorated with @Init");
  }
  return object as unknown as InitObject;
}

function initAsync(object: CanInit | InitObject) {
  const init = wrap(() => object.__init());
  if (queueMicrotask == null) {
    setTimeout(init, 0);
    return;
  }
  queueMicrotask(init);
}

function initSync(object: CanInit | InitObject) {
  wrap(() => object.__init())();
}

export { INIT_MARK, Init, ensureInitObject, initAsync, initSync };
export type { CanInit, InitObject };
