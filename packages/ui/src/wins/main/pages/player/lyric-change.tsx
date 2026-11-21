import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { lyricLanguageName, lyricLanguageLabel } from "@/common/lib/lyric-language";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const LyricChange: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const {
    canShowNotes,
    rmExisted,
    tlExisted,
    translationLanguages = []
  } = player.current.lyric?.info || {};
  const { rmActive, tlActive, noteActive } = player.current;
  const activeLanguages = player.activeTranslationLanguages;
  const items = [
    {
      key: "rm",
      label: "音",
      title: "切换音译歌词",
      active: rmActive,
      existed: rmExisted,
      toggle: () => player.toggleLyric("rm")
    },
    {
      key: "note",
      label: "注",
      title: "切换注音",
      active: noteActive,
      existed: canShowNotes,
      toggle: () => player.toggleLyric("note")
    },
    ...(translationLanguages.length > 1
      ? translationLanguages.map((language) => ({
          key: `tl-${language}`,
          label: lyricLanguageLabel(language, translationLanguages),
          title: `切换${lyricLanguageName(language)}翻译`,
          active: activeLanguages.includes(language),
          existed: true,
          toggle: () => player.toggleTranslationLanguage(language)
        }))
      : [
          {
            key: "tl",
            label: "译",
            title: "切换翻译歌词",
            active: tlActive,
            existed: tlExisted,
            toggle: () => player.toggleLyric("tl")
          }
        ])
  ];

  return (
    <div className="absolute right-8 bottom-10 flex flex-col gap-2 select-none">
      {items.map(({ key, label, title, active, toggle, existed }) => (
        <button
          key={key}
          className={cx(
            `
              flex size-5 items-center justify-center overflow-hidden rounded-sm
              text-[12px] font-semibold outline-none
              transition-all duration-300 ease-in-out
              active:scale-98 surface-1 cursor-pointer
            `,
            active && existed && "bg-ink text-inverse-ink",
            !existed && "cursor-not-allowed! opacity-60"
          )}
          title={title}
          aria-label={title}
          disabled={!existed}
          aria-pressed={!!active}
          onClick={toggle}>
          {label}
        </button>
      ))}
    </div>
  );
};

export default memo(LyricChange);
