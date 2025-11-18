import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const PlayerBarCover: FC<object> = () => {
  const { info } = usePlayer();
  const { TogglePlayerModalVisible } = useLayout();
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2">
      <img
        className="h-full rounded-md cursor-pointer"
        src={info.cover}
        alt={info.title}
        onClick={() => TogglePlayerModalVisible(true)}
      />
      <div className="flex flex-col gap-0">
        <div className="text-sm font-medium text-center">{info.title}</div>
        <div className="text-xs text-center text-gray-500">{info.artist}</div>
      </div>
    </div>
  );
};
export default memo(PlayerBarCover);
