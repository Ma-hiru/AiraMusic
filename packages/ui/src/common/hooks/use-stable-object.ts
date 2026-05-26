import { useRef } from "react";

export function useStableObject<T extends Record<PropertyKey, unknown> | null>(obj: T): T {
  const ref = useRef<T>(obj);

  if (obj === null || ref.current === null || !shallowEqualObject(ref.current, obj)) {
    ref.current = obj;
  }

  return ref.current;
}

export function shallowEqualObject<T extends Record<PropertyKey, unknown>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  const aKeys = Object.keys(a) as Array<keyof T>;
  const bKeys = Object.keys(b) as Array<keyof T>;

  if (aKeys.length !== bKeys.length) return false;

  for (const key of bKeys) {
    if (!Object.prototype.hasOwnProperty.call(a, key)) return false;
    if (!Object.is(a[key], b[key])) return false;
  }

  return true;
}
