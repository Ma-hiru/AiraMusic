import { FC, memo } from "react";

const Divider: FC<object> = () => {
  return <div className="w-full bg-black/10 h-0.5 my-3 shadow-lg" />;
};
export default memo(Divider);
