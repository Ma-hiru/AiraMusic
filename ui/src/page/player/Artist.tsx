import { FC, Fragment, memo } from "react";
import { Heart } from "lucide-react";
import { useHeart } from "@mahiru/ui/hook/useHeart";
import { usePlayerStatus } from "@mahiru/ui/store";

const Artist: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = trackStatus?.track;
  const { likeChange, isLiked } = useHeart(track);
  return (
    <div className="relative w-full flex justify-between gap-1 overflow-hidden items-center text-white/50 h-3.5 text-[12px] select-none">
      <div className="flex gap-1 justify-start items-center truncate">
        {track?.ar?.map((a, index) => {
          return (
            <Fragment key={a.id}>
              <span
                className="hover:opacity-50 cursor-pointer active:scale-90 ease-in-out duration-300 transition-all truncate"
                key={a.id}>
                {a.name}
              </span>
              {index < track?.ar.length - 1 ? <span className="text-white/20">/</span> : null}
            </Fragment>
          );
        })}
      </div>
      <div>
        <Heart
          color={isLiked ? "white" : undefined}
          fill={isLiked ? "white" : "transparent"}
          className="size-4 text-white/50  hover:opacity-50 active:scale-90 cursor-pointer select-none shadow-lg ease-in-out duration-300 transition-all opacity-80"
          onClick={likeChange}
        />
      </div>
    </div>
  );
};
export default memo(Artist);
