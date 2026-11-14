import { SquareArrowOutUpRight } from "lucide-react";
import IconButton from "@/common/components/data-input/icon-button";
import type { ReactNode } from "react";

import AppDrawer from "./use";
import type { DrawerRender } from "./drawer-provider";

export type SearchDrawerProps = {
  content: ReactNode;
  toggleKey?: string;
  onPageAction?: NormalFunc;
};

export function createSearchDrawer({
  onPageAction,
  content,
  toggleKey = "search"
}: SearchDrawerProps): DrawerRender {
  return {
    toggleKey,
    title: "搜索",
    width: 480,
    resizable: { minWidth: 420, maxWidth: 720 },
    contentClassName: "overflow-hidden!",
    headerActions: onPageAction ? (
      <IconButton
        label="展开搜索页"
        variant="plain"
        iconClassName="size-4!"
        icon={SquareArrowOutUpRight}
        onClick={() => {
          AppDrawer.close();
          onPageAction();
        }}
      />
    ) : undefined,
    content
  };
}
