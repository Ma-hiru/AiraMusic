import { FC, memo } from "react";
import AppEntry from "@mahiru/ui/windows/main/entry";

const Title: FC<object> = () => {
  const player = AppEntry.usePlayer();
  const track = player.current.track?.detail;
  const ts = track?.translate?.();
  const alias = track?.aliaName?.();
  const title = track?.splitTitle?.();
  return (
    <div className="flex flex-col select-none w-full justify-end">
      <div className="text-white text-center">
        <span className="block w-full font-bold text-[24px] truncate">{title?.main}</span>
        {!!title?.sub && (
          <span className="block w-full opacity-50 text-[14px] truncate">{title.sub}</span>
        )}
        {ts ? (
          <span className="block w-full opacity-50 text-[12px] truncate">{ts}</span>
        ) : alias ? (
          <span className="block w-full opacity-50 text-[12px] truncate">{alias}</span>
        ) : null}
      </div>
    </div>
  );
};
export default memo(Title);
