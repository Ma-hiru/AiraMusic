import { memo, type FC, useEffect, type ComponentProps } from "react";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";

import ArtistV2 from "../artist-v2";
import LegacyArtist from "../artist";

type ArtistProps = ComponentProps<typeof LegacyArtist> & {
  onAddList?: NormalFunc;
  onReplace?: NormalFunc;
  setIsTyping?: NormalFunc<[typing: boolean]>;
};

const ArtistSwitch: FC<ArtistProps> = (props) => {
  const { setIsTyping } = props;
  const { legacy } = usePlaylistLayout();
  useEffect(() => () => setIsTyping?.(false), [legacy, setIsTyping]);
  return legacy ? <LegacyArtist {...props} /> : <ArtistV2 {...props} />;
};

export type { ArtistRef } from "../artist";

export default memo(ArtistSwitch) as typeof ArtistSwitch;
