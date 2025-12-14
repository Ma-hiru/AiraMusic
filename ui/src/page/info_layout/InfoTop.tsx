import { FC, memo } from "react";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import TopControlPure from "@mahiru/ui/componets/public/TopControlPure";

const InfoTop: FC<object> = () => {
  return (
    <Drag className="h-10 flex items-center justify-between px-6 select-none">
      <div />
      <TopControlPure maximizable={false} mini={false} />
    </Drag>
  );
};
export default memo(InfoTop);
