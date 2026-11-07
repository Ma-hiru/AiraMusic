import { memo, type FC, useEffect, type ComponentProps } from "react";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";

import AlbumV2 from "../album-v2";
import LegacyAlbum from "../album";

type AlbumProps = ComponentProps<typeof LegacyAlbum> & {
  onReplace?: NormalFunc;
  setIsTyping?: NormalFunc<[typing: boolean]>;
};

const AlbumSwitch: FC<AlbumProps> = (props) => {
  const { setIsTyping } = props;
  const { legacy } = usePlaylistLayout();
  useEffect(() => () => setIsTyping?.(false), [legacy, setIsTyping]);
  return legacy ? <LegacyAlbum {...props} /> : <AlbumV2 {...props} />;
};

export type { AlbumPageRef } from "../album";

export default memo(AlbumSwitch) as typeof AlbumSwitch;
