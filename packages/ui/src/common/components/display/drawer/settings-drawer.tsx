import { SquareArrowOutUpRight } from "lucide-react";
import IconButton from "@/common/components/data-input/icon-button";
import type { ReactNode } from "react";

import AppDrawer from "./use";
import type { DrawerRender } from "./drawer-provider";

export function createSettingsDrawer({
  onPageAction,
  content
}: {
  content: ReactNode;
  onPageAction: NormalFunc;
}): DrawerRender {
  return {
    toggleKey: "settings",
    title: "设置",
    width: 480,
    resizable: { minWidth: 420, maxWidth: 720 },
    contentClassName: "overflow-hidden!",
    headerActions: (
      <IconButton
        label="展开设置页"
        variant="plain"
        iconClassName="size-4!"
        icon={SquareArrowOutUpRight}
        onClick={() => {
          AppDrawer.close();
          onPageAction();
        }}
      />
    ),
    content
  };
}
