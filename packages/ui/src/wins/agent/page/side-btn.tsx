import { Bot, PanelLeftOpen, PanelRightClose } from "lucide-react";
import { memo, type FC, type Dispatch, type SetStateAction } from "react";
import NoDrag from "@/common/components/layout/drag/no-drag";
import IconButton from "@/common/components/data-input/icon-button";

interface SideBtnProps {
  statusText: string;
  openList: boolean;
  setOpenList: Dispatch<SetStateAction<boolean>>;
}

const SideBtn: FC<SideBtnProps> = ({ openList, setOpenList, statusText }) => {
  return (
    <NoDrag className="flex shrink-0 items-center justify-start gap-2 text-sm">
      <IconButton
        size="compact"
        variant="ghost"
        label={openList ? "关闭对话列表" : "打开对话列表"}
        iconClassName="size-4.5! text-white/60!"
        icon={openList ? PanelRightClose : PanelLeftOpen}
        onClick={() => setOpenList((opened) => !opened)}
      />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-1.5 py-0.5 text-[11px] font-semibold text-white/60">
        <Bot className="size-3.5" />
        {statusText}
      </span>
    </NoDrag>
  );
};

export default memo(SideBtn);
