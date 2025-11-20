import { FC, useCallback, useEffect, useRef, useState } from "react";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import Top from "@mahiru/ui/page/playlist/Top";
import List from "@mahiru/ui/page/playlist/List";
import Divider from "@mahiru/ui/page/playlist/Divider";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { useParams } from "react-router-dom";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import CachedProvider from "@mahiru/ui/ctx/CachedProvider";
import { SearchTrack } from "@mahiru/wasm";

const PlayListPage: FC<object> = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState<Nullable<NeteasePlaylistDetailResponse>>(null);

  const [filterTracks, setFilterTracks] = useState<
    NeteasePlaylistDetailResponse["playlist"]["tracks"]
  >([]);
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);
  const tracks = useRef<NeteasePlaylistDetailResponse["playlist"]["tracks"]>([]);
  useEffect(() => {
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
          const result: NeteasePlaylistDetailResponse["playlist"]["tracks"] = [];
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
      <CachedProvider>
        <List filterTracks={filterTracks} />
      </CachedProvider>
    </div>
  );
};
export default PlayListPage;

async function requestPlayListDetail(id: number) {
  try {
    return await getPlaylistDetail(id, false);
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
