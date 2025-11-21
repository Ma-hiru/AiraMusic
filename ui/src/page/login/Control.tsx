import { FC, memo } from "react";
import ControlButton from "@mahiru/ui/page/layout/top/TopControl";
import { Drag } from "@mahiru/ui/componets/public/Drag";

const Control: FC<object> = () => {
  return (
    <Drag className="h-6 flex items-center justify-end absolute top-0 left-0 right-0 p-6 px-5">
      <ControlButton windowId={"login"} maximizable={false} />
    </Drag>
  );
};
export default memo(Control);
