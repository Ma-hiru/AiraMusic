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

type NormalFunc<P extends any[] = never[], R = void> = (...args: P) => R;

type PromiseFunc<P extends any[] = never[], R = void> = (...args: P) => Promise<R>;

type IndexRange = [start: number, end: number];

interface HasID {
  id: string | number;
}
