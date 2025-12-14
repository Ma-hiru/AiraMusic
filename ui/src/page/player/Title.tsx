import { FC, memo } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { splitTrackTitle } from "@mahiru/ui/utils/str";

const Title: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = trackStatus?.track;
  const alias = track?.alia?.length ? track.alia[0] : "";
  const ts = track?.tns?.length ? track.tns[0] : "";
  const title = splitTrackTitle(trackStatus?.track.name);
  return (
    <div className="flex flex-col select-none w-full justify-end">
      <div className="text-white text-center">
        <span className="block w-full font-bold text-[24px] truncate">{title.main}</span>
        {!!title.sub && (
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
