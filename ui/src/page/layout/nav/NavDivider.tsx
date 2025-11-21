import { FC, memo } from "react";

const NavDivider: FC<object> = () => {
  return <span className="h-[2px] my-4 mx-auto w-[95%] bg-[#7b8290]/10" />;
};
export default memo(NavDivider);
