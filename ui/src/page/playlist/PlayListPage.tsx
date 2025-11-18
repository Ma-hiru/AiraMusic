import { FC, memo, useDeferredValue, useEffect, useState } from "react";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import Top from "@mahiru/ui/page/playlist/Top";
import List from "@mahiru/ui/page/playlist/List";
import Divider from "@mahiru/ui/page/playlist/Divider";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { useParams } from "react-router-dom";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

const PlayListPage: FC<object> = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState<Nullable<NeteasePlaylistDetailResponse>>(null);
  useEffect(() => {
    if (id) {
      requestPlayListDetail(Number(id)).then((res) => {
        res && setDetail(res);
      });
    }
  }, [id, detail]);
  return (
    <div className="w-full h-full px-12 pt-20">
      <Top detail={detail} />
      <Divider />
      <List detail={detail} />
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
