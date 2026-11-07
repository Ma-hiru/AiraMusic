import { cx } from "@emotion/css";
import { Play, Check, ListPlus, UserRound, PanelsTopLeft, RotateCwSquare } from "lucide-react";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react";
import { Log } from "@/common/lib/log";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseArtist } from "@/common/netease/models";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";
import AppToast from "@/common/components/display/toast";
import PageAction from "@/common/components/display/page-action";
import IconButton from "@/common/components/data-input/icon-button";

import Info from "./info";
import Avatar from "./avatar";

interface HeaderProps {
  className?: string;
  reload: NormalFunc;
  showIntro?: boolean;
  children?: ReactNode;
  artist: Nullable<NeteaseArtist>;
  pageActionType?: "out" | "none" | "enter";
  onAddList?: NormalFunc;
  onPlayAll?: NormalFunc;
  onShowIntro: NormalFunc;
  onPageAction?: NormalFunc;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
}

const actionClassName = `
  inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5
  rounded-md border px-3 py-1.5
  text-[12px] font-semibold transition-all duration-200 ease-in-out
  active:scale-98 disabled:pointer-events-none disabled:opacity-35
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60
`;

const Header: FC<HeaderProps> = ({
  className,
  pageActionType = "none",
  onAddList,
  onPlayAll,
  onShowIntro,
  onPageAction,
  onAvatarLoaded,
  artist,
  reload,
  children,
  showIntro = false
}) => {
  const { toggleLayout } = usePlaylistLayout();
  const artistID = artist?.id;
  const { alias, trans } = useMemo(() => {
    const trans = [...(artist?.detail.artist.transNames ?? [])];
    const alias = [...(artist?.detail.artist.alias ?? [])];
    if (trans.length === 0 && alias.length >= 1) trans.push(alias.shift()!);
    return { trans: trans.join(" / "), alias: alias.join(" / ") };
  }, [artist?.detail.artist.alias, artist?.detail.artist.transNames]);

  const initialFollow = useMemo(
    () => ({
      id: artistID,
      followed: artist?.followInfos.follow ?? false,
      fansCount: artist?.followInfos.fansCnt ?? 0,
      hasFollowedDays: artist?.followInfos.followDay ?? ""
    }),
    [
      artistID,
      artist?.followInfos.follow,
      artist?.followInfos.fansCnt,
      artist?.followInfos.followDay
    ]
  );
  const [followState, setFollowState] = useState(initialFollow);
  const current = followState.id === artistID ? followState : initialFollow;
  const currentRef = useLatestRef(current);
  const artistIDRef = useLatestRef(artistID);
  const requestRef = useRef<Nullable<{ id: number }>>(null);
  const [pendingID, setPendingID] = useState<Optional<number>>();
  const pending = pendingID !== undefined && pendingID === artistID;

  useEffect(() => {
    if (requestRef.current?.id === initialFollow.id) return;
    requestRef.current = null;
    setPendingID(undefined);
    setFollowState(initialFollow);
  }, [initialFollow]);

  useEffect(
    () => () => {
      requestRef.current = null;
    },
    []
  );

  const followText = useMemo(() => {
    if (!current.followed) return "关注";
    if (current.hasFollowedDays) {
      return `已关注 (${current.hasFollowedDays.replace(/^已关注\s*/, "")})`;
    }
    return "已关注";
  }, [current.followed, current.hasFollowedDays]);

  const follow = useCallback(async () => {
    if (!artistID || requestRef.current?.id === artistID) return;
    const previous = currentRef.current;
    const followed = !previous.followed;
    const request = { id: artistID };
    requestRef.current = request;
    setPendingID(artistID);
    setFollowState({
      ...previous,
      followed,
      fansCount: Math.max(0, previous.fansCount + (followed ? 1 : -1)),
      hasFollowedDays: followed ? previous.hasFollowedDays : ""
    });

    try {
      const response = await NeteaseAPIArtist.subscribe(artistID, followed);
      if (response.code !== 200) throw new Error(response.message || "关注状态更新失败");
      if (requestRef.current !== request || artistIDRef.current !== artistID) return;
      AppToast.show({ type: "success", text: followed ? "关注成功" : "取消关注成功" });
    } catch (err) {
      if (requestRef.current !== request || artistIDRef.current !== artistID) return;
      setFollowState(previous);
      Log.error(err);
      AppToast.show({
        type: "error",
        text: followed ? "关注失败，请重试" : "取消关注失败，请重试"
      });
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setPendingID(undefined);
      }
    }
  }, [artistID, artistIDRef, currentRef]);

  return (
    <div
      className={cx("grid h-full min-h-0 w-full grid-cols-[12rem_minmax(0,1fr)] gap-6", className)}>
      <aside className="min-h-0 min-w-0 overflow-y-auto border-r border-white/10 pb-2 pr-3 [scrollbar-gutter:stable] scrollbar scrollbar-show">
        <Avatar
          className="aspect-square w-full shrink-0"
          artist={artist}
          onAvatarLoaded={onAvatarLoaded}
        />
        <Info
          alias={alias}
          trans={trans}
          artist={artist}
          showIntro={showIntro}
          fansCount={current.fansCount}
          onShowIntro={onShowIntro}
        />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="line-clamp-2 select-text text-[24px] font-bold leading-tight wrap-break-word">
                {artist?.detail.artist.name ?? "未知歌手"}
              </h1>
              {trans && (
                <p className="mt-1 select-text text-[13px] opacity-65 wrap-break-word">{trans}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <IconButton
                size="compact"
                variant="ghost"
                label="切换到简约版歌手"
                icon={PanelsTopLeft}
                onClick={toggleLayout}
              />
              <IconButton
                className="scale-110!"
                label="刷新"
                size="compact"
                variant="ghost"
                icon={RotateCwSquare}
                onClick={reload}
              />
              <PageAction
                size="compact"
                variant="ghost"
                type={pageActionType}
                onClick={onPageAction}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className={cx(
                actionClassName,
                "border-transparent bg-primary text-primary-text hover:bg-primary-active"
              )}
              type="button"
              disabled={!artist?.hotTracks.length || !onPlayAll}
              onClick={onPlayAll}>
              <Play className="size-3.5" />
              播放热门
            </button>
            <button
              className={cx(actionClassName, "border-white/20 bg-white/5 hover:bg-white/15")}
              type="button"
              disabled={!artist?.hotTracks.length || !onAddList}
              onClick={onAddList}>
              <ListPlus className="size-3.5" />
              加入队列
            </button>
            <button
              className={cx(actionClassName, "border-white/20 bg-white/5 hover:bg-white/15")}
              type="button"
              aria-busy={pending}
              disabled={!artist || pending}
              aria-pressed={current.followed}
              onClick={follow}>
              {current.followed ? (
                <Check className="size-3.5" />
              ) : (
                <UserRound className="size-3.5" />
              )}
              {followText}
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
};

export default memo(Header);
