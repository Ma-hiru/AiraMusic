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

type AssertOptional<T extends Optional<any>, U> = T extends null | undefined ? T : U;

type NormalFunc<P extends any[] = never[], R = void> = (...args: P) => R;

type PromiseFunc<P extends any[] = never[], R = void> = (...args: P) => Promise<R>;

type ValidationReject<T> = { field: keyof T; reason: string };

type NormalEventPayload<T extends NormalEvent> = NormalEventMaps[T];

type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];

type RenderInvokeEventHandler<T extends InvokeEvent> =
  InvokeEventArgs<T> extends never
    ? () => Promise<InvokeEventPayload<T>>
    : (param: InvokeEventArgs<T>) => Promise<InvokeEventPayload<T>>;

type RenderNormalEventHandler<T extends NormalEvent> =
  NormalEventPayload<T> extends never ? () => void : (param: NormalEventPayload<T>) => void;

type RenderEventAPI = {
  [K in NormalEvent]: RenderNormalEventHandler<K>;
};

type RenderInvokeAPI = {
  [K in InvokeEvent]: RenderInvokeEventHandler<K>;
};
