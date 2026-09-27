import { EqError } from "../err";

export type Color = `#${string}`;

export const Colors = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  white: "#ffffff",
  gray: "#9ca3af",
  darkGray: "#4b5563",
  black: "#000000"
} as const satisfies Record<string, Color>;

export function colorText(hex: Color, input: string) {
  let value = hex.slice(1);
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char.repeat(2))
      .join("");
  }
  if (value.length !== 6) throw new EqError(`Invalid Hex RGB color: ${hex}`);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m${input}\x1b[0m`;
}
