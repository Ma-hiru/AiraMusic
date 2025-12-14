import { FC, memo } from "react";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { useLayoutStatus } from "@mahiru/ui/store";

const Background: FC<object> = () => {
  const { background } = useLayoutStatus(["background"]);
  return (
    <div className="fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc] z-0">
      <AcrylicBackground src={background} />
    </div>
  );
};
export default memo(Background);
