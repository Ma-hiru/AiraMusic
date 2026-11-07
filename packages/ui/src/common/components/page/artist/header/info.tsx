import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useLayoutEffect
} from "react";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseArtist } from "@/common/netease/models";
import { useListenResize } from "@/common/hooks/use-listen-resize";
import AppToast from "@/common/components/display/toast";
import Marquee from "@/common/components/display/marquee";

interface InfoProps {
  className?: string;
  children?: ReactNode;
  artist: Nullable<NeteaseArtist>;
}

const Info: FC<InfoProps> = ({ className, artist, children }) => {
  const artistName = artist?.detail.artist.name ?? "-";
  const { alias, trans } = useMemo(() => {
    const trans: string[] = [...(artist?.detail.artist.transNames ?? [])];
    const alias: string[] = [...(artist?.detail.artist.alias ?? [])];
    if (trans.length === 0 && alias.length >= 1) trans.push(alias.shift()!);
    return { trans: trans.join(" / "), alias: alias.join(" / ") };
  }, [artist?.detail.artist.alias, artist?.detail.artist.transNames]);

  const [hasFollowedDays, setHasFollowedDays] = useState("");
  const [followed, setFollowed] = useState(artist?.followInfos.follow ?? false);
  const [fansCount, setFansCount] = useState(artist?.followInfos.fansCnt ?? 0);
  const followText = useMemo(() => {
    if (!followed) return "关注";
    if (hasFollowedDays) return `已关注 (${hasFollowedDays.replace(/^已关注\s*/, "")})`;
    return "已关注";
  }, [followed, hasFollowedDays]);
  const loading = useRef(false);
  const follow = useCallback(() => {
    if (!artist?.id) return;
    if (loading.current) return;
    setFollowed(!followed);
    setFansCount(fansCount + (followed ? -1 : 1));
    // 取消关注时，清空关注天数
    if (followed) setHasFollowedDays("");

    loading.current = true;
    NeteaseAPIArtist.subscribe(artist.id, !followed)
      .then(() => {
        AppToast.show({
          type: "success",
          text: followed ? "取消关注成功" : "关注成功"
        });
      })
      .finally(() => {
        loading.current = false;
      });
  }, [artist?.id, fansCount, followed]);

  useEffect(() => {
    setHasFollowedDays(artist?.followInfos.followDay ?? "");
  }, [artist?.followInfos.followDay]);

  const desc = artist?.detail.artist.briefDesc ?? "";
  const descRef = useRef<HTMLParagraphElement>(null);
  const descRevision = useListenResize(descRef);
  const [descOverflow, setDescOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandDesc = useCallback(() => setExpanded((prev) => !prev), []);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [desc]);

  useLayoutEffect(() => {
    const paragraph = descRef.current;
    if (!paragraph || !paragraph.offsetHeight || expanded) return;
    setDescOverflow(paragraph.offsetHeight < paragraph.scrollHeight);
  }, [desc, descRevision, expanded]);

  return (
    <section className={cx("flex flex-col items-start justify-start", className)}>
      <div
        className={cx(
          "relative inline-flex flex-col items-start text-3xl font-bold contain-layout",
          trans && "pt-4"
        )}>
        <h1 className="whitespace-nowrap select-all" children={artistName} />
        {trans && (
          <div
            className="absolute left-0 top-0 w-full truncate text-center text-[13px] font-medium opacity-75 select-all"
            title={trans}>
            <Marquee as="h2" text={trans} options={{ gapDuration: 5_000, speed: 20 }} />
          </div>
        )}
      </div>

      <h2
        className={cx("mt-auto text-[13px] font-medium select-text", !alias && "invisible")}
        children={`别名: ${alias}`}
      />
      <div className="inline-flex items-center gap-2 text-[13px] font-medium select-none contain-layout">
        <span className="pr-0.5">粉丝: {RendererFormat.count(fansCount)}</span>
        <span>/</span>
        <TextButton className="font-semibold" children={followText} onClick={follow} />
      </div>

      <section className="shrink-0 flex items-end justify-start max-w-[72%] text-[13px] font-medium leading-tight">
        <div
          className={cx(
            "select-text",
            expanded && "overflow-y-auto overflow-x-hidden scrollbar scrollbar-show"
          )}>
          <p
            ref={descRef}
            className={cx(!expanded ? "line-clamp-3" : "line-clamp-none max-h-20 pr-2")}
            children={desc}
          />
        </div>
        {descOverflow && (
          <TextButton
            className="shrink-0 relative top-1"
            children={!expanded ? "展开" : "收起"}
            onClick={expandDesc}
          />
        )}
      </section>

      {!!children && <div className="self-end contain-layout" children={children} />}
    </section>
  );
};

export default memo(Info);

const TextButton = ({
  className,
  ...props
}: {
  children: string;
  className?: string;
  onClick?: NormalFunc;
}) => (
  <button
    className={cx(
      `
      cursor-pointer rounded-md px-0.5 py-0.5
      hover:bg-primary hover:text-primary-text
      active:scale-98 select-none
      transition-all duration-300 ease-in-out
    `,
      className
    )}
    type="button"
    {...props}
  />
);
