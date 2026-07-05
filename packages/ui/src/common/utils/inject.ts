import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { useStableObject } from "@/common/hooks/use-stable-object";

const INJECT_MARK = Symbol("INJECT_MARK");

type InjectProps<T extends object> = Pick<T, Extract<keyof T, `__${string}`>>;

type CanInject<T extends object> = {
  __cb?(props: InjectProps<T>): void;
  __inject(props: InjectProps<T>): void;
};

type InjectObject<T extends object> = CanInject<T> & {
  readonly [INJECT_MARK]: true;
};

function wrap(init: NormalFunc) {
  return () => {
    try {
      init();
    } catch (err) {
      Log.error("inject", err);
    }
  };
}

/**
 * 自动在对象上生成 `__inject` 方法，方法参数为一个对象，里面是需要注入的字段或方法 \
 * 以 `__` 开头的字段就是需要注入的字段
 * */
function Inject<T extends AnyClass>(_: T, context: ClassDecoratorContext<T>) {
  context.addInitializer(function () {
    Object.defineProperties(this, {
      [INJECT_MARK]: {
        value: true,
        writable: false,
        enumerable: false,
        configurable: false
      },
      __inject: {
        value: function (props: InjectProps<typeof this>) {
          Object.assign(this, props);
        },
        writable: false,
        enumerable: false,
        configurable: true
      }
    });
  });
}

export function InjectWithCallback(cb: NormalFunc) {
  return function Inject<T extends AnyClass>(_: T, context: ClassDecoratorContext<T>) {
    context.addInitializer(function () {
      Object.defineProperties(this, {
        [INJECT_MARK]: {
          value: true,
          writable: false,
          enumerable: false,
          configurable: false
        },
        __cb: {
          value: cb,
          writable: false,
          enumerable: false,
          configurable: false
        },
        __inject: {
          value: function (props: InjectProps<typeof this>) {
            Object.assign(this, props);
          },
          writable: false,
          enumerable: false,
          configurable: true
        }
      });
    });
  };
}

function ensureInjectObject<T extends object>(cls: T): InjectObject<T> {
  if (!(INJECT_MARK in cls)) {
    throw new Error("Class must be decorated with @Inject");
  }
  return cls as unknown as InjectObject<T>;
}

function useInject<T extends object>(
  object: CanInject<T> | InjectObject<T>,
  props: InjectProps<T>
) {
  const stableProps = useStableObject(props);
  useEffect(() => {
    wrap(() => object.__inject(stableProps))();
    wrap(() => object.__cb?.(stableProps))();
  }, [object, stableProps]);
}

export { Inject, useInject, INJECT_MARK, ensureInjectObject };
export type { CanInject, InjectProps, InjectObject };
