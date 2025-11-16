import { FC, memo } from "react";

const PlayListPage: FC<object> = () => {
  return (
    <div className="w-screen h-screen flex justify-center items-center bg-black text-md font-mono text-white">
      Play List Page
    </div>
  );
};
export default memo(PlayListPage);
