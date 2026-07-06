import { PanelLeftOpen, PanelRightClose } from "lucide-react";
import { memo, type FC, type Dispatch, type SetStateAction } from "react";
import NoDrag from "@/common/components/layout/drag/no-drag";
import IconButton from "@/common/components/data-input/icon-button";

interface SideBtnProps {
  openList: boolean;
  setOpenList: Dispatch<SetStateAction<boolean>>;
}

const SideBtn: FC<SideBtnProps> = ({ openList, setOpenList }) => {
  return (
    <NoDrag className="flex shrink-0 items-center justify-start gap-2 text-sm">
      <IconButton
        size="compact"
        variant="ghost"
        iconClassName="size-4.5!"
        label={openList ? "关闭对话列表" : "打开对话列表"}
        icon={openList ? PanelRightClose : PanelLeftOpen}
        onClick={() => setOpenList((opened) => !opened)}
      />
      <img className="size-4.5" src="/images/logo.svg" alt={import.meta.env.APP_NAME} />
      <h1 className="leading-normal font-semibold tracking-tight">
        {import.meta.env.APP_NAME} Agent
      </h1>
    </NoDrag>
  );
};

export default memo(SideBtn);
