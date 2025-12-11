import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Title: FC<object> = () => {
  const { trackStatus } = usePlayer();
  const track = trackStatus?.track;
  const alias = track?.alia?.length ? track.alia[0] : "";
  const ts = track?.tns?.length ? track.tns[0] : "";
  const title = handleTitle(trackStatus?.track.name);
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

function handleTitle(title: Optional<string>) {
  if (!title) return { main: "", sub: "" };
  if (
    (title.includes("(") && title.includes(")")) ||
    (title.includes("（") && title.includes("）"))
  ) {
    const start = title.indexOf("(");
    const end = title.indexOf(")");
    const main = title.substring(0, start) + title.substring(end + 1, title.length);
    const sub = title.substring(start, end + 1);
    return {
      main: main.trim(),
      sub: sub.trim()
    };
  } else {
    return {
      main: title,
      sub: ""
    };
  }
}
