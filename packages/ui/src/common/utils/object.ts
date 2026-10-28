export function pick<const T extends object, const F extends (keyof T)[]>(
  obj: T,
  fields: F
): Pick<T, F[number]> {
  const res: Record<string, any> = {};
  const f = new Set(fields);
  for (const [key, value] of Object.entries(obj)) f.delete(key as keyof T) && (res[key] = value);
  return res as Pick<T, F[number]>;
}
