import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Cover: FC<object> = () => {
  const { cover } = usePlayer();
  return (
    <img
      className="sm:w-[200px] lg:w-[300px] object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal pointer-events-none"
      src={cover}
      alt="小さな恋のうた - 石見舞菜香"
    />
  );
};
export default memo(Cover);
