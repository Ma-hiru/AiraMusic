import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Cover: FC<object> = () => {
  const { info } = usePlayer();
  return (
    <img
      className="sm:w-[200px] lg:w-[300px] object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal pointer-events-none"
      src={info.cover}
      alt={info.album}
    />
  );
};
export default memo(Cover);
