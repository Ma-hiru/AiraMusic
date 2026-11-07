import { memo, type FC, useEffect, type ComponentProps } from "react";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";
import type { PlaylistScope } from "@/common/types/playlist-scope";

import PlaylistV2 from "../playlist-v2";
import LegacyPlaylist from "../playlist";

type PlaylistProps = ComponentProps<typeof LegacyPlaylist> & {
  initialScope?: Nullable<PlaylistScope>;
};

const PlaylistSwitch: FC<PlaylistProps> = (props) => {
  const { setIsTyping } = props;
  const { legacy } = usePlaylistLayout();
  useEffect(() => () => setIsTyping?.(false), [legacy, setIsTyping]);
  return legacy ? <LegacyPlaylist {...props} /> : <PlaylistV2 {...props} />;
};

export type { PlaylistRef } from "../playlist-v2";

export default memo(PlaylistSwitch) as typeof PlaylistSwitch;
