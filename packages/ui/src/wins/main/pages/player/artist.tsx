import { type FC, Fragment, memo, useCallback } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { useHeart } from "@/common/hooks/use-heart";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { cx } from "@emotion/css";

interface ArtistProps {
  className?: string;
}

const Artist: FC<ArtistProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const setPlayModal = useSetAtom(playModalAtom);
  const { heartManager } = useUserTrackManager();
  const { likedChange, checkLiked } = useHeart(heartManager);
  const { jumpArtistPage } = usePageJump();
  const track = player.current.track?.detail;

  const jump = useCallback(
    (id: number) => {
      jumpArtistPage(id);
      setPlayModal(false);
    },
    [jumpArtistPage, setPlayModal]
  );

  const starTrack = useCallback(() => likedChange(track), [likedChange, track]);

  const openComment = useCallback(async () => {
    if (!track) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererEventBus.comment.send({
      id: track.id,
      type: "track"
    });
  }, [track]);

  return (
    <section
      className={cx("relative flex justify-between gap-1 items-center flex-nowrap", className)}>
      <div className="flex-1 flex gap-1 items-center truncate">
        {track?.ar?.map((a, index) => {
          return (
            <Fragment key={a.id}>
              <a
                className="hover:opacity-50 cursor-pointer active:scale-98 ease-in-out duration-300 transition-all truncate"
                onClick={() => jump(a.id)}>
                {a.name}
              </a>
              {index < track?.ar.length - 1 && <span className="opacity-20 font-medium">/</span>}
            </Fragment>
          );
        })}
      </div>
      <div className="shrink-0 flex justify-center items-center gap-1 xl:gap-2">
        <Heart
          color={checkLiked(track) ? "currentColor" : undefined}
          fill={checkLiked(track) ? "currentColor" : "transparent"}
          className="size-4 xl:size-4.5 hover:opacity-50 active:scale-98 cursor-pointer ease-in-out duration-300 transition-all"
          onClick={starTrack}
        />
        <MessageSquare
          color="currentColor"
          fill="currentColor"
          onClick={openComment}
          className="size-4 xl:size-4.5 scale-90 hover:opacity-50 active:scale-88 cursor-pointer ease-in-out duration-300 transition-all"
        />
      </div>
    </section>
  );
};
export default memo(Artist);
