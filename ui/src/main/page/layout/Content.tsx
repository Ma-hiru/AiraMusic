import { FC, memo, useEffect } from "react";
import { cx } from "@emotion/css";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";
import AppInstance from "@mahiru/ui/main/entry/instance";
import { NeteaseTrackRecord, NeteaseUser } from "@mahiru/ui/public/models/netease";
import { useUserStore } from "@mahiru/ui/public/store/user";
import NeteaseSource from "@mahiru/ui/public/entry/source";

const Content: FC<object> = () => {
  const { _user } = useUserStore();
  const player = AppInstance.usePlayer();

  useEffect(() => {
    const user = NeteaseUser.fromObject(_user);
    if (!user) return;
    NeteaseSource.Playlist.fromSummary(user.likedPlaylist).then((playlist) => {
      player.playlist.replace(NeteaseTrackRecord.fromPlaylist(playlist), 0);
      console.log("Loaded liked playlist", playlist);
    });
  }, [_user, player.playlist]);
  return (
    <div
      className={cx(
        `
            relative flex-1 pb-18 pt-10 bg-white
            ease-in-out duration-300 transition-all
          `
      )}>
      <KeepAliveOutlet maxCache={3} />
    </div>
  );
};
export default memo(Content);
