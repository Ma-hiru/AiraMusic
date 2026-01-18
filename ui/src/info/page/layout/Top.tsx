import { FC, memo } from "react";

import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure";

interface InfoProps {
  color?: string;
}

const Top: FC<InfoProps> = ({ color }) => {
  return (
    <Drag className="absolute w-screen h-10 flex items-center justify-between px-6 select-none z-100">
      <div />
      <TopControlPure maximizable={false} color={color} />
    </Drag>
  );
};
export default memo(Top);
