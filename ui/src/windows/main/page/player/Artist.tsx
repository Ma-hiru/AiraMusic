import { FC, memo } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { useHeart } from "@mahiru/ui/public/hooks/useHeart";
import AppEntry from "@mahiru/ui/windows/main/entry";

const Artist: FC<object> = () => {
  const player = AppEntry.usePlayer();
  const { likeChange, isTrackLiked } = useHeart();
  const track = player.current.track?.detail;

  return (
    <div className="relative w-full flex justify-between gap-1 overflow-hidden items-center text-white/50 h-3.5 text-[12px] select-none">
      <div className="flex gap-1 justify-start items-center truncate">
        {track?.ar?.map((a, index) => {
          return (
            <div key={a.id}>
              <span className="hover:opacity-50 cursor-pointer active:scale-90 ease-in-out duration-300 transition-all truncate">
                {a.name}
              </span>
              {index < track?.ar.length - 1 ? <span className="text-white/20">/</span> : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-center items-center gap-2 pr-1">
        <Heart
          color={isTrackLiked(track) ? "white" : undefined}
          fill={isTrackLiked(track) ? "white" : "transparent"}
          className="size-4 text-white/50  hover:opacity-50 active:scale-90 cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
          onClick={() => likeChange(track)}
        />
        <MessageSquare
          color="white"
          fill="white"
          // onClick={() => handleOpenComments(track)}
          className="size-4 scale-90 text-white/50  hover:opacity-50 active:scale-90 active:text-white cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
        />
      </div>
    </div>
  );
};
export default memo(Artist);
