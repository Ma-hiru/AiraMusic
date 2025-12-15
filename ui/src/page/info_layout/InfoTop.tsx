import { FC, memo } from "react";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import TopControlPure from "@mahiru/ui/componets/public/TopControlPure";

interface InfoProps {
  color?: string;
}

const InfoTop: FC<InfoProps> = ({ color }) => {
  return (
    <Drag className="h-10 flex items-center justify-between px-6 select-none">
      <div />
      <TopControlPure maximizable={false} mini={false} color={color} />
    </Drag>
  );
};
export default memo(InfoTop);
