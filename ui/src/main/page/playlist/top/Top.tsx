import { FC, memo } from "react";

import TopCover from "./TopCover";
import TopRight from "./TopRight";
import TopInfo from "./TopInfo";
import { NeteasePlaylist } from "@mahiru/ui/public/models/netease";
import { PlaylistSource } from "@mahiru/ui/main/constants";
import Title from "@mahiru/ui/main/componets/Title";
import Search from "@mahiru/ui/public/components/public/Search";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

interface TopProps {
  type: PlaylistSource;
  loading: boolean;
  summary: Nullable<NeteasePlaylist>;
  searchTracks: NormalFunc<[k: string]>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
  historyCount: number;
}

const Top: FC<TopProps> = ({
  summary,
  searchTracks,
  onPlayAll,
  onAddList,
  type,
  loading,
  historyCount
}) => {
  const { other, updateOther } = useLayoutStore();
  const setTyping = (typing: boolean) => {
    updateOther(other.copy().setTyping(typing));
  };

  if (loading && type !== "history") return null;
  return type !== "history" ? (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[1fr_auto]">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover summary={summary} />
        <TopInfo summary={summary} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <TopRight summary={summary} type={type} searchTracks={searchTracks} setTying={setTyping} />
    </div>
  ) : (
    <Title
      className="mb-4"
      title={
        <div className="flex items-center">
          <span>历史记录</span>
          <span className="opacity-30 scale-80">({historyCount} 记录)</span>
        </div>
      }
      slot={<Search searchTracks={searchTracks} setIsTyping={setTyping} />}
    />
  );
};

export default memo(Top);
