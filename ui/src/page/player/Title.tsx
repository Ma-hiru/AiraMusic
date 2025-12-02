import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Title: FC<object> = () => {
  const { info } = usePlayer();
  const title = handleTitle(info.title);
  return (
    <div className="flex flex-col select-none w-full justify-end">
      <div className="text-white text-center">
        <span className="block w-full font-bold text-[24px] truncate">{title.main}</span>
        {!!title.sub && (
          <span className="block w-full opacity-50 text-[14px] truncate">{title.sub}</span>
        )}
        {info.tsTitle ? (
          <span className="block w-full opacity-50 text-[12px] truncate">{info.tsTitle}</span>
        ) : info.alias ? (
          <span className="block w-full opacity-50 text-[12px] truncate">{info.alias}</span>
        ) : null}
      </div>
    </div>
  );
};
export default memo(Title);

function handleTitle(title: string) {
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
