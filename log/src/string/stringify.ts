export type CanString =
  | { toString: () => any }
  | { [Symbol.toPrimitive]: (hint: string) => any }
  | undefined
  | object
  | string
  | number
  | boolean
  | symbol
  | bigint
  | Function
  | unknown;

export function AnyToString(input: CanString): string {
  if (typeof input === "function") return `[Function: ${input.name}]`;
  if (typeof input === "object" && input !== null) {
    if (input instanceof Error && input.message) return input.message + "\n" + input.stack;
    if (Symbol.toPrimitive in input && typeof input[Symbol.toPrimitive] === "function") {
      try {
        const toPrimitive = input[Symbol.toPrimitive] as (hint: string) => any;
        return AnyToString(toPrimitive("string"));
      } catch (err) {
        console.error(err);
      }
    }
    if (typeof input.toString === "function" && input.toString !== Object.prototype.toString) {
      try {
        return AnyToString(input.toString());
      } catch (err) {
        console.error(err);
      }
    }
    try {
      return JSON.stringify(input, null, 2);
    } catch (err) {
      console.error(err);
    }
  }
  return String(input);
}
