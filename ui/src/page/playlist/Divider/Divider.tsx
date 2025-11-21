import { FC, memo } from "react";

const Divider: FC<object> = () => {
  return <div className="w-full bg-black/10 h-[2px] my-3 shadow-lg" />;
};
export default memo(Divider);
