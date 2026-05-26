import { type FC, memo, type ReactEventHandler, useCallback } from "react";
import { useSetAtom } from "jotai";
import { backgroundCoverAtom } from "@mahiru/ui/windows/main/atoms/theme";
import AppEntry from "@mahiru/ui/windows/main/entry";

import NeteaseImage from "../../../../common/components/image/netease-image";

const Cover: FC<object> = () => {
  const setBackgroundCover = useSetAtom(backgroundCoverAtom);
  const player = AppEntry.usePlayer();
  const image = player.current.cover;

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => setBackgroundCover(e.currentTarget.src),
    [setBackgroundCover]
  );

  return (
    <NeteaseImage
      cache
      preview
      cacheLazy={false}
      image={image}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};

export default memo(Cover);
