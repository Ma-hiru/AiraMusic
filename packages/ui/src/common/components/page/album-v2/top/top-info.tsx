import { cx } from "@emotion/css";
import { ChevronRight } from "lucide-react";
import {
  memo,
  type FC,
  useMemo,
  type JSX,
  useCallback,
  createElement,
  type ComponentProps
} from "react";
import { createAlbumStats } from "@/common/utils/playlist";
import { NeteaseAlbum, NeteaseNetworkImage } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppModal, { createAlbumCoverModal } from "@/common/components/display/modal";

interface TopInfoProps {
  coverCacheKey?: string;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
}

const TopInfo: FC<TopInfoProps> = ({ album, dynamic, coverCacheKey }) => {
  const { create } = AppModal.useModal();
  const stats = createAlbumStats(album, dynamic);
  const avatar = useMemo(() => {
    return NeteaseNetworkImage.fromURL(album?.content.artist.picUrl)?.setSize(
      RendererImageConstants.PlaylistPageCreatorAvatarSize
    );
  }, [album]);
  const artists = useMemo(() => {
    if (!album) return [];
    return (album.content.artists ?? [])
      .filter((artist) => artist.name !== album.content.artist.name)
      .concat([album.content.artist])
      .filter(Boolean);
  }, [album]);
  const tags = useMemo(() => {
    if (!album) return [];
    return [...new Set([album.content.type, album.content.subType, album.content.tags])].filter(
      Boolean
    );
  }, [album]);
  const description = album?.content.description?.trim() ?? "";

  const openDetails = useCallback(() => {
    if (!album || !dynamic) return;
    const cacheKey =
      (coverCacheKey ?? "") + album.content.publishTime + (album.tracks[0]?.id ?? "");
    create(createAlbumCoverModal, { album, dynamic, coverCacheKey: cacheKey });
  }, [album, coverCacheKey, create, dynamic]);

  if (!album) return null;
  return (
    <div className="min-w-0 space-y-3 pt-1">
      <Section className="flex justify-between items-center gap-1" title="艺术家" noTitle noPadding>
        <section className="flex flex-1 justify-start items-center gap-1 min-w-0">
          <NeteaseImage className="size-4 shrink-0 rounded-full" image={avatar} cache />
          <p
            className="select-text text-[12px] font-semibold truncate"
            title={artists.map((artist) => artist.name).join(" / ")}>
            {artists.map((artist) => artist.name).join(" / ")}
          </p>
        </section>
      </Section>
      <Section
        className="grid select-text grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3"
        as="dl"
        title="信息"
        noTitle
        noPadding>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className={cx("min-w-0", label === "发行" && "sm:col-span-2")}>
            <dt className="flex items-center gap-1 text-[10px] leading-4 opacity-55">
              <Icon className="size-3 shrink-0" />
              {label}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold leading-4 tabular-nums opacity-85">
              {value}
            </dd>
          </div>
        ))}
      </Section>
      <Section title="标签">
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-primary/50 px-1 py-px text-[10px] text-primary-text opacity-80">
              {tag}
            </span>
          ))}
          {tags.length === 0 && <p className="text-[11px] italic opacity-45">暂无标签</p>}
        </div>
      </Section>
      <Section title="唱片公司" show={!!album.content.company}>
        <p className="select-text text-[11px] leading-4 opacity-75 wrap-break-word">
          {album.content.company}
        </p>
      </Section>
      <Section title="简介">
        <p
          className={cx(
            "line-clamp-3 select-text whitespace-pre-wrap text-[11px] leading-4 wrap-break-word",
            description ? "opacity-75" : "italic opacity-45"
          )}>
          {description || "暂无简介"}
        </p>
        {description && (
          <button
            className="mt-1.5 flex cursor-pointer items-center gap-0.5 text-[11px] opacity-65 transition-opacity duration-200 hover:opacity-100"
            type="button"
            disabled={!dynamic}
            onClick={openDetails}>
            展开
            <ChevronRight className="size-3" />
          </button>
        )}
      </Section>
    </div>
  );
};

export default memo(TopInfo);

const Section: FC<
  ComponentProps<"section"> & {
    show?: boolean;
    asChild?: boolean;
    noTitle?: boolean;
    noPadding?: boolean;
    as?: keyof JSX.IntrinsicElements;
  }
> = ({
  className,
  title,
  children,
  show = true,
  as = "section",
  asChild = false,
  noTitle = false,
  noPadding = false,
  ...rest
}) => {
  if (!show) return null;
  if (asChild) return children;
  return createElement(
    as,
    {
      title,
      className: cx(!noPadding && "border-t border-white/15 pt-2", className),
      ...rest
    },
    <>
      {!!title && !noTitle && <h2 className="mb-1.5 text-[12px] font-semibold">{title}</h2>}
      {children}
    </>
  );
};
