import { Draft } from "immer";
import { StoreApi } from "zustand";

export type ZustandSet<T> = (
  partial: T | Partial<T> | ((draft: Draft<T>) => void | T | Partial<T>),
  replace?: boolean
) => void;

export type ZustandGet<T> = () => T;

export type ZustandApi<T> = StoreApi<T>;

export interface ZustandConfig<T, U = T> {
  (set: ZustandSet<U>, get: ZustandGet<T>, api: ZustandApi<T>): T;
}
