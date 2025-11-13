import { FC, memo } from "react";
import { BackgroundRender } from "@mahiru/ui/componets/player/BackgroundRender";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Background: FC<object> = () => {
  const { cover } = usePlayer();
  return (
    <BackgroundRender
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%"
      }}
      album={cover}
    />
  );
};
export default memo(Background);
