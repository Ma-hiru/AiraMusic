import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const LyricChange: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const { rmExisted, tlExisted, noteExisted } = player.current.lyric?.info || {};
  const { rmActive, tlActive, noteActive } = player.current;

  const items = [
    {
      key: "rm",
      label: "音",
      title: "切换音译歌词",
      active: rmActive,
      existed: rmExisted
    },
    {
      key: "note",
      label: "注",
      title: "切换注音",
      active: noteActive,
      existed: noteExisted
    },
    {
      key: "tl",
      label: "译",
      title: "切换翻译歌词",
      active: tlActive,
      existed: tlExisted
    }
  ] as const;

  return (
    <div className="absolute right-8 bottom-10 flex flex-col gap-2 select-none">
      {items.map(({ key, label, title, active, existed }) => (
        <button
          key={key}
          title={title}
          disabled={!existed}
          onClick={() => player.toggleLyric(key)}
          className={cx(
            `
              flex size-5 items-center justify-center overflow-hidden rounded-sm
              text-[12px] font-semibold outline-none
              transition-all duration-300 ease-in-out
              active:scale-98 surface-1 cursor-pointer
            `,
            active && existed && "bg-white text-black",
            !existed && "cursor-not-allowed! opacity-60"
          )}>
          {label}
        </button>
      ))}
    </div>
  );
};

export default memo(LyricChange);
