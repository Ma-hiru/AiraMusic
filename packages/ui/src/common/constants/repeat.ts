import { Repeat1, Repeat2, RepeatOff } from "lucide-react";

export const repeatModeControls = {
  off: { label: "循环关闭", icon: RepeatOff, next: "one" },
  one: { label: "单曲循环", icon: Repeat1, next: "all" },
  all: { label: "列表循环", icon: Repeat2, next: "off" }
} as const;
