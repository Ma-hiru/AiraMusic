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

type NormalFunc<P extends any[] = never[], R = void> = (...args: P) => R;

type PromiseFunc<P extends any[] = never[], R = void> = (...args: P) => Promise<R>;

type IndexRange = [start: number, end: number];

type UnPromise<T extends Promise<infer P>> = P;

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
