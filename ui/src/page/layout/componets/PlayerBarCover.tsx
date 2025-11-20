import { FC, memo, useEffect, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

const PlayerBarCover: FC<object> = () => {
  const { info } = usePlayer();
  const { TogglePlayerModalVisible } = useLayout();
  const [cachedCover, setCachedCover] = useState<Nullable<string>>(null);
  useEffect(() => {
    setCachedCover(wrapCacheUrl(info.cover));
  }, [info.cover]);
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2">
      <img
        className="h-full rounded-md cursor-pointer"
        src={cachedCover as string}
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
