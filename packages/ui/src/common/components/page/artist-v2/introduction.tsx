import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { NeteaseArtist } from "@/common/netease/models";
import AppEmpty from "@/common/components/fallback/app-empty";

interface IntroductionProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
}

const Introduction: FC<IntroductionProps> = ({ className, artist }) => {
  const brief = artist?.desc.briefDesc || artist?.detail.artist.briefDesc || "";
  const sections = artist?.desc.introduction ?? [];

  if (!brief && sections.length === 0) {
    return <AppEmpty className={className} tips="暂无歌手介绍" />;
  }

  return (
    <article
      className={cx(
        "min-h-0 overflow-y-auto pr-3 pb-5 pt-4 scrollbar scrollbar-show [scrollbar-gutter:stable] select-text",
        className
      )}>
      <div className="max-w-160 space-y-6">
        {brief && (
          <section>
            <h2 className="mb-3 text-[14px] font-semibold">简介</h2>
            <p className="whitespace-pre-wrap text-[13px] leading-7 opacity-80 wrap-break-word">
              {brief}
            </p>
          </section>
        )}
        {sections.map(({ ti, txt }, index) => (
          <section key={`${ti}-${index}`}>
            {ti && <h2 className="mb-3 text-[14px] font-semibold">{ti}</h2>}
            <p className="whitespace-pre-wrap text-[13px] leading-7 opacity-80 wrap-break-word">
              {txt}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
};

export default memo(Introduction);
