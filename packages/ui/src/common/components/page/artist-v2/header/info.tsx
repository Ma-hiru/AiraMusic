import { memo, type FC } from "react";
import { Disc3, Video, ListMusic, UsersRound, ChevronRight } from "lucide-react";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseArtist } from "@/common/netease/models";

interface InfoProps {
  alias: string;
  trans: string;
  fansCount: number;
  showIntro?: boolean;
  artist: Nullable<NeteaseArtist>;
  onShowIntro: NormalFunc;
}

const Info: FC<InfoProps> = ({
  onShowIntro,
  alias,
  trans,
  artist,
  fansCount,
  showIntro = false
}) => {
  if (!artist) return null;
  const detail = artist.detail.artist;
  const identities = [...new Set(detail.identities ?? [])].filter(Boolean);
  const description = detail.briefDesc || artist.desc.briefDesc;
  const hasIntro = !!(description || artist.desc.introduction.length);
  const stats = [
    { label: "歌曲", value: detail.musicSize, icon: ListMusic },
    { label: "专辑", value: detail.albumSize, icon: Disc3 },
    { label: "MV", value: detail.mvSize, icon: Video },
    { label: "粉丝", value: fansCount, icon: UsersRound }
  ];

  return (
    <div className="min-w-0 space-y-3 pt-3">
      {(alias || trans) && (
        <div className="space-y-1.5 select-text text-[11px] leading-5 wrap-break-word">
          {trans && (
            <p>
              <span className="mr-1.5 opacity-50">译名</span>
              <span className="opacity-80">{trans}</span>
            </p>
          )}
          {alias && (
            <p>
              <span className="mr-1.5 opacity-50">别名</span>
              <span className="opacity-80">{alias}</span>
            </p>
          )}
        </div>
      )}
      {identities.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="歌手身份">
          {identities.map((identity) => (
            <span
              key={identity}
              className="rounded-sm bg-white/10 px-1.5 py-px text-[10px] opacity-70">
              {identity}
            </span>
          ))}
        </div>
      )}
      <dl className="grid select-text grid-cols-2 gap-x-3 gap-y-2.5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0">
            <dt className="flex items-center gap-1 text-[10px] leading-4 opacity-55">
              <Icon className="size-3 shrink-0" />
              {label}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold leading-4 tabular-nums opacity-85">
              {RendererFormat.count(value) || "0"}
            </dd>
          </div>
        ))}
      </dl>
      {hasIntro && (
        <section className="border-t border-white/15 pt-3">
          {!showIntro && description && (
            <>
              <h2 className="mb-1.5 text-[12px] font-semibold">简介</h2>
              <p className="line-clamp-4 select-text whitespace-pre-wrap text-[11px] leading-5 opacity-75 wrap-break-word">
                {description}
              </p>
            </>
          )}
          <button
            className="mt-1.5 flex cursor-pointer items-center gap-0.5 text-[11px] opacity-65 transition-opacity duration-200 hover:opacity-100 disabled:cursor-default disabled:opacity-45"
            type="button"
            disabled={showIntro}
            onClick={onShowIntro}>
            {showIntro ? "正在查看介绍" : "查看介绍"}
            {!showIntro && <ChevronRight className="size-3" />}
          </button>
        </section>
      )}
    </div>
  );
};

export default memo(Info);
