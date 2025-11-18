import { FC, memo, useEffect, useState } from "react";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import Top from "@mahiru/ui/page/playlist/Top";
import List from "@mahiru/ui/page/playlist/List";
import Divider from "@mahiru/ui/page/playlist/Divider";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";

const PlayListPage: FC<object> = () => {
  const [testDetailData, setTestDetailData] =
    useState<Nullable<NeteasePlaylistDetailResponse>>(null);
  useEffect(() => {
    fetch("/playListDetail.json")
      .then((res) => res.json())
      .then(setTestDetailData);
  }, []);
  return (
    <div className="w-full h-full px-12 pt-20">
      <Top detail={testDetailData} />
      <Divider />
      <List detail={testDetailData} />
    </div>
  );
};
export default memo(PlayListPage);

async function getPlayListDetail(id: number) {
  const result = await getPlaylistDetail(id);
}
