import Top from "./Top/Top";
import List from "./List/List";
import Divider from "./Divider/Divider";
import { FC, useCallback, useLayoutEffect, useRef, useState } from "react";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useParams } from "react-router-dom";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";
import { SearchTrack } from "@mahiru/wasm";

interface PlayListPageProps {
  setId?: number;
  isLikedList?: boolean;
}

const PlayListPage: FC<PlayListPageProps> = ({ setId, isLikedList }) => {
  const { id: defaultID } = useParams();
  const id: Undefinable<string> = setId ? String(setId) : defaultID;
  const [detail, setDetail] = useState<Nullable<NeteasePlaylistDetailResponse>>(null);

  const [filterTracks, setFilterTracks] = useState<NeteaseTrack[]>([]);
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);
  const tracks = useRef<NeteaseTrack[]>([]);

  useLayoutEffect(() => {
    if (id) {
      requestPlayListDetail(Number(id)).then((res) => {
        if (res) {
          tracks.current = res.playlist.tracks;
          setSearchTrackInstance(new SearchTrack(JSON.stringify(tracks.current)));
          setFilterTracks(tracks.current);
          setDetail(res);
        }
      });
    }
  }, [id]);

  const searchTracks = useCallback(
    (k: string) => {
      if (k.trim() === "") {
        setFilterTracks(tracks.current);
      } else {
        if (searchTrackInstance) {
          const lowerK = k.toLowerCase();
          const indexs = searchTrackInstance.search(lowerK);
          const result: NeteaseTrack[] = [];
          indexs.forEach((i) => {
            result.push(tracks.current[i]!);
          });
          setFilterTracks(result);
        }
      }
    },
    [searchTrackInstance]
  );
  return (
    <div className="w-full h-full px-12 pt-20">
      <Top detail={detail} searchTracks={searchTracks} />
      <Divider />
      <BlobCachedProvider>
        <List filterTracks={filterTracks} />
      </BlobCachedProvider>
    </div>
  );
};
export default PlayListPage;

async function requestPlayListDetail(id: number) {
  try {
    return await getPlaylistDetail(id);
  } catch (err) {
    Log.error(
      new EqError({
        raw: err,
        label: "ui/playListPage:requestPlayListDetail",
        message: "Failed to fetch playlist detail"
      })
    );
  }
}
