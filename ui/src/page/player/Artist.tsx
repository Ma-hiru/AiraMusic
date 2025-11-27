import { FC, Fragment, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Artist: FC<object> = () => {
  const { info } = usePlayer();
  return (
    <div className="w-full flex gap-1 justify-start text-white/50 text-[12px] select-none w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px]">
      {info.artist.map((a, index) => {
        return (
          <Fragment key={a.id}>
            <span className="hover:opacity-50 cursor-pointer active:scale-90 " key={a.id}>
              {a.name}
            </span>
            {index < info.artist.length - 1 ? <span className="text-white/20">/</span> : null}
          </Fragment>
        );
      })}
    </div>
  );
};
export default memo(Artist);
