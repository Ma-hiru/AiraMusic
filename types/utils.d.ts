type RemoveFirstArg<T extends (...args: any[]) => any> = T extends (
  first: any,
  ...args: infer P
) => infer R
  ? (...args: P) => R
  : never;

type RestParams<T> = T extends (firstArg: any, ...args: infer R) => any ? R : never;

type FirstParams<T> = T extends (firstArg: infer F, ...args: any[]) => any ? F : never;

type Nullable<T> = T | null;

type Undefinable<T> = T | undefined;

type Optional<T> = T | null | undefined;

type Falsy = false | 0 | "" | null | undefined;

type NullishValue = null | undefined;

type NormalFunc<P extends readonly any[] = never[], R = void> = (...args: P) => R;

type PromiseFunc<P extends readonly any[] = never[], R = void> = (...args: P) => Promise<R>;

type IndexRange = [start: number, end: number];

interface HasID {
  id: string | number;
}

type NetworkStatus =
  | "offline" // 系统无网络
  | "dns_error" // DNS 无法解析
  | "tcp_error" // 无法建立连接
  | "tls_error" // TLS / 证书异常（常见于劫持）
  | "http_blocked" // HTTP 被阻断 / 重定向
  | "ok"; // 网络正常

interface CanInit {
  _init: NormalFunc;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonPrimitive = null | boolean | number | string;

type Jsonify<T> =
  // 1. 函数直接去掉
  T extends (...args: any[]) => any
    ? never
    : // 2. JSON 原始值保留
      T extends JsonPrimitive
      ? T
      : // 3. 数组递归处理元素
        T extends readonly (infer U)[]
        ? Jsonify<U>[]
        : // 4. 对象递归处理字段，并删除结果为 never 的字段
          T extends object
          ? {
              [K in keyof T as Jsonify<T[K]> extends never ? never : K]: Jsonify<T[K]>;
            }
          : // 5. 其他类型不属于 JSON，去掉
            never;

type AnyClass = abstract new (...args: any[]) => any;
