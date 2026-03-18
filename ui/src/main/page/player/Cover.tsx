import { FC, memo, ReactEventHandler, useCallback } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import AppInstance from "@mahiru/ui/main/entry/instance";

const Cover: FC<object> = () => {
  const { theme, updateTheme } = useLayoutStore();
  const player = AppInstance.usePlayer();
  const image = player.current.cover;

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      updateTheme(theme.copy().setBackgroundCover(e.currentTarget.src));
    },
    [theme, updateTheme]
  );

  return (
    <NeteaseImage
      cache
      preview
      image={image}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};
export default memo(Cover);
