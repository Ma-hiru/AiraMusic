import { FC, memo, useEffect, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

const BarCover: FC<object> = () => {
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
        src={(cachedCover || null) as string}
        alt={info.title}
        onClick={() => TogglePlayerModalVisible(true)}
      />
      <div className="flex flex-col gap-0 items-start">
        <div className="text-sm font-medium text-center">{info.title}</div>
        <div className="text-xs text-center text-gray-500">
          {(info.artist || []).map((a) => a.name).join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
