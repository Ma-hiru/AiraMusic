import { FC, memo } from "react";
import { BackgroundRender } from "@mahiru/ui/componets/player/BackgroundRender";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const Background: FC<object> = () => {
  const { info } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  return (
    <BackgroundRender
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%"
      }}
      album={info.cover}
      staticMode={!PlayerModalVisible}
    />
  );
};
export default memo(Background);
