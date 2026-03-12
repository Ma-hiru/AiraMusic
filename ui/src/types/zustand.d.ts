import { Draft } from "immer";
import { StoreApi } from "zustand";

export type ZustandSet<T> = (
  partial: T | Partial<T> | ((draft: Draft<T>) => void | T | Partial<T>)
) => void;

export type ZustandGet<T> = () => T;

export type ZustandApi<T> = StoreApi<T>;

export interface ZustandConfig<InitState, Actions> {
  (
    set: ZustandSet<InitState>, // i
    get: ZustandGet<InitState & Actions>,
    api: ZustandApi<InitState & Actions>
  ): InitState & Actions;
}
