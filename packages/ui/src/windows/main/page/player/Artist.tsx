import { FC, memo, useCallback } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { useHeart } from "@mahiru/ui/common/hooks/useHeart";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";
import { useArtistOrAlbumPageJump } from "@mahiru/ui/windows/main/hooks/useArtistOrAlbumPageJump";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";

const Artist: FC<object> = () => {
  const player = AppEntry.usePlayer();
  const { heartManager } = useUserTrackManager();
  const { likedChange, checkLiked } = useHeart(heartManager);
  const { jumpArtistPage } = useArtistOrAlbumPageJump();
  const track = player.current.track?.detail;

  const jump = useCallback(
    (id: number) => {
      jumpArtistPage(id);
      const { layout, updateLayout } = getLayoutStoreSnapshot();
      layout.playModal && updateLayout(layout.copy().setPlayModal(false));
    },
    [jumpArtistPage]
  );

  return (
    <div className="relative w-full flex justify-between gap-1 overflow-hidden items-center text-white/50 h-3.5 text-[12px] select-none">
      <div className="flex gap-1 justify-start items-center truncate">
        {track?.ar?.map((a, index) => {
          return (
            <div key={a.id}>
              <span
                className="hover:opacity-50 cursor-pointer active:scale-90 ease-in-out duration-300 transition-all truncate"
                onClick={() => jump(a.id)}>
                {a.name}
              </span>
              {index < track?.ar.length - 1 ? <span className="text-white/20">/</span> : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-center items-center gap-2 pr-1">
        <Heart
          color={checkLiked(track) ? "white" : undefined}
          fill={checkLiked(track) ? "white" : "transparent"}
          className="size-4 text-white/50  hover:opacity-50 active:scale-90 cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
          onClick={() => likedChange(track)}
        />
        <MessageSquare
          color="white"
          fill="white"
          onClick={async () => {
            if (!track) return;
            await ElectronServicesWindow.comment.openAwait();
            ElectronServicesBus.comment.send({
              id: track.id,
              type: "track"
            });
          }}
          className="size-4 scale-90 text-white/50  hover:opacity-50 active:scale-90 active:text-white cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
        />
      </div>
    </div>
  );
};
export default memo(Artist);
