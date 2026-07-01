import { cx } from "@emotion/css";

export type TextVariant = "body" | "meta" | "badge" | "sectionTitle" | "sectionCaption";

export const textClassNames: Record<TextVariant, string> = {
  sectionTitle: "text-xl font-bold",
  sectionCaption: "text-[10px] font-bold uppercase tracking-widest opacity-50",
  body: "text-[13px] font-medium leading-5",
  meta: "text-[12px] font-semibold opacity-70",
  badge: "text-[11px] font-semibold"
};

export function getTextClassName(variant: TextVariant, className?: string) {
  return cx(textClassNames[variant], className);
}
