import { FC, memo } from "react";

import Drag from "@mahiru/ui/public/components/public/Drag";
import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure";

const Control: FC<object> = () => {
  return (
    <Drag className="h-6 flex items-center justify-end absolute top-0 left-0 right-0 p-6 px-5">
      <TopControlPure maximizable={false} />
    </Drag>
  );
};
export default memo(Control);
