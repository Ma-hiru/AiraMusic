import { FC, memo } from "react";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import TopControl from "@mahiru/ui/page/layout/top/TopControl";

const InfoTop: FC<object> = () => {
  return (
    <Drag className="h-10 flex items-center justify-between px-6 select-none">
      <div />
      <TopControl windowId={"info"} maximizable={false} mini={false} />
    </Drag>
  );
};
export default memo(InfoTop);
