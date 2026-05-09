import { FC, memo } from "react";
import { NeteasePlaylist } from "@mahiru/ui/public/source/netease/models";
import { PlaylistSource } from "@mahiru/ui/public/enum";

import TopCover from "./TopCover";
import TopRight from "./TopRight";
import TopInfo from "./TopInfo";
import Search from "@mahiru/ui/public/components/public/Search";
import AppTitle from "@mahiru/ui/public/components/title/AppTitle";

interface TopProps {
  type: PlaylistSource;
  loading: boolean;
  summary: Nullable<NeteasePlaylist>;
  searchTracks: NormalFunc<[k: string]>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
  historyCount: number;
  coverCacheKey?: string;
  onCoverLoaded?: NormalFunc<[src: string]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const Top: FC<TopProps> = ({
  summary,
  searchTracks,
  onPlayAll,
  onAddList,
  type,
  loading,
  historyCount,
  coverCacheKey,
  onCoverLoaded,
  setIsTyping = () => {},
  onPageAction,
  pageActionType
}) => {
  if (loading && type !== "history") return null;
  return type !== "history" ? (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[1fr_auto]">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover summary={summary} coverCacheKey={coverCacheKey} onCoverLoaded={onCoverLoaded} />
        <TopInfo summary={summary} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <TopRight
        summary={summary}
        type={type}
        searchTracks={searchTracks}
        setTying={setIsTyping}
        pageActionType={pageActionType}
        onPageAction={onPageAction}
      />
    </div>
  ) : (
    <AppTitle
      className="mb-4"
      title={
        <div className="flex items-center">
          <span>历史记录</span>
          <span className="opacity-30 scale-80">({historyCount} 记录)</span>
        </div>
      }
      slot={<Search searchTracks={searchTracks} setIsTyping={setIsTyping} />}
    />
  );
};

export default memo(Top);
