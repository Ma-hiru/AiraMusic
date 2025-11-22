import { FC, memo } from "react";
import { BackgroundRender } from "@mahiru/ui/componets/player/BackgroundRender";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

const Background: FC<object> = () => {
  const { info } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  const cachedBackground = useFileCache(setImageURLSize(info.cover, "lg"));
  return (
    <BackgroundRender
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%"
      }}
      album={cachedBackground}
      staticMode={!PlayerModalVisible}
    />
  );
};
export default memo(Background);
