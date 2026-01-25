export type CanString =
  | { toString: () => any }
  | undefined
  | object
  | string
  | number
  | boolean
  | symbol
  | bigint
  | Function;

export function AnyToString(input: CanString): string {
  if (input && typeof input === "object") {
    if (input instanceof Error) return input.stack || input.message;
    if (typeof input.toString === "function" && input.toString !== Object.prototype.toString) {
      try {
        return String(input.toString());
      } catch (err) {
        console.error(err);
      }
    }
    try {
      return JSON.stringify(input, null, 2);
    } catch (err) {
      console.error(err);
      return String(input);
    }
  }
  if (typeof input === "function") {
    return `[Function: ${input.name || "anonymous"}]`;
  }
  return String(input);
}
