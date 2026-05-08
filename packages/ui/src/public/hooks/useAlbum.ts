import { useCallback, useEffect, useState } from "react";
import { RequestStatus } from "@mahiru/ui/public/hooks/useRequestWrap";
import { useImmer } from "use-immer";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";
import { Log } from "@mahiru/ui/public/utils/dev";
import NCM from "@mahiru/ui/public/source/netease/api";

export function useAlbum(props: { id: number; pageSize?: number }) {
  const [status, setStatus] = useState<RequestStatus | "idle">("idle");
  const [album, setAlbum] = useImmer<AlbumState>(() => ({
    data: [],
    totalAlbum: 0,
    totalPageNo: 0,
    currentPageNo: 0,
    hasMore: true
  }));

  const propsRef = useLatestRef(props);
  const statusRef = useLatestRef(status);
  const albumRef = useLatestRef(album);
  const loadMore = useCallback(() => {
    const { id, pageSize } = propsRef.current;
    const { currentPageNo, hasMore } = albumRef.current;
    const isLoading = statusRef.current === "loading";
    if (isLoading || !hasMore) return;

    setStatus("loading");
    NCM.Artist.albums({
      id,
      pageSize: pageSize || 20,
      pageNo: currentPageNo + 1
    })
      .then((response) => {
        setAlbum((draft) => {
          draft.totalAlbum = response.artist.albumSize;
          draft.hasMore = response.more;
          draft.currentPageNo++;
          draft.totalPageNo = Math.ceil(response.artist.albumSize / (pageSize || 20));
          draft.data = mergeUniqueAlbum(draft.data, response.hotAlbums);
        });
        setStatus("success");
      })
      .catch((err) => {
        Log.error(`useAlbum(${id})`, err);
        setStatus("error");
      });
  }, [albumRef, propsRef, setAlbum, statusRef]);

  useEffect(() => {
    setAlbum({
      data: [],
      totalAlbum: 0,
      totalPageNo: 0,
      currentPageNo: 0,
      hasMore: true
    });
  }, [
    setAlbum,
    // props变化时重置状态
    props.id,
    props.pageSize
  ]);
  useEffect(() => {
    if (!props.id) return;
    if (!album.hasMore || album.currentPageNo !== 0) return;
    loadMore();
  }, [album.currentPageNo, album.hasMore, loadMore, props.id]);

  return {
    album,
    loadMore,
    status
  };
}

export type AlbumState = {
  data: NeteaseAPI.ArtistAlbum[];
  totalAlbum: number;
  totalPageNo: number;
  currentPageNo: number;
  hasMore: boolean;
};

function mergeUniqueAlbum(oldList: NeteaseAPI.ArtistAlbum[], newList: NeteaseAPI.ArtistAlbum[]) {
  const exists = new Set(oldList.map((item) => item.id));
  const result = [...oldList];

  for (const item of newList) {
    if (exists.has(item.id)) continue;
    exists.add(item.id);
    result.push(item);
  }

  return result;
}
