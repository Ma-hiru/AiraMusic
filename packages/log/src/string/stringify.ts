export const JSONCompact = Symbol("json_compact");
export const JSONFlat = Symbol("json_flat");

export function AnyToString(input: unknown): string {
  if (typeof input === "function") return `[Function: ${input.name}]`;
  if (typeof input === "object" && input !== null) {
    if (input instanceof Error && input.message) return input.message + "\n" + input.stack;
    if (Symbol.toPrimitive in input && typeof input[Symbol.toPrimitive] === "function") {
      try {
        const toPrimitive = input[Symbol.toPrimitive] as (hint: string) => any;
        return AnyToString(toPrimitive.apply(input, ["string"]));
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
      const is_compact: unknown = JSONCompact in input && input[JSONCompact];
      const is_flat: unknown = JSONFlat in input && input[JSONFlat];
      if (is_flat) {
        const text = Object.entries(input)
          .map(([key, value]) => `${is_compact ? "" : "\n"}${key}=${AnyToString(value)}`)
          .join(is_compact ? "," : "");
        return is_compact ? text : text + "\n";
      }
      return JSON.stringify(input, null, is_compact ? undefined : 2);
    } catch (err) {
      console.error(err);
    }
  }
  return String(input);
}
