import { NeteasePlaylistDetail, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useEffect, useRef, useState } from "react";
import { PlayListController } from "@mahiru/ui/hook/playList/controller";

export function usePlayListPagination(playList: NeteasePlaylistDetail, defaultLimit = 20) {
  const controller = useRef(new PlayListController(playList)).current;

  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(defaultLimit);
  const [tracks, setTracks] = useState<NeteaseTrack[]>([]);

  useEffect(() => {
    let mounted = true;
    const get = () => {
      controller.getPage(page, limit).then((data) => {
        if (mounted) setTracks(data as NeteaseTrack[]);
      });
    };
    get();
    const unsubscribe = controller.subscribe(get);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [controller, limit, page]);

  return {
    page,
    setPage,
    limit,
    setLimit,
    tracks,
    total: playList.trackIds.length
  };
}
