import { type FC, memo } from "react";
import { NeteasePlaylist } from "@/common/netease/models";

import TopCover from "./top-cover";
import TopRight from "./top-right";
import TopInfo from "./top-info";

interface TopProps {
  editable: boolean;
  loading: boolean;
  summary: Nullable<NeteasePlaylist>;
  searchTracks: NormalFunc<[k: string]>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
  coverCacheKey?: string;
  onCoverLoaded?: NormalFunc<[src: string]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  onEdited?: NormalFunc;
  onDeleted?: NormalFunc;
  selectionMode?: boolean;
  onToggleSelectionMode?: NormalFunc;
}

const Top: FC<TopProps> = ({
  summary,
  searchTracks,
  onPlayAll,
  onAddList,
  editable,
  loading,
  coverCacheKey,
  onCoverLoaded,
  setIsTyping = () => {},
  onPageAction,
  pageActionType,
  onEdited,
  onDeleted,
  selectionMode,
  onToggleSelectionMode
}) => {
  if (loading) return null;
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[3fr_1fr] gap-3">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover summary={summary} coverCacheKey={coverCacheKey} onCoverLoaded={onCoverLoaded} />
        <TopInfo summary={summary} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <TopRight
        summary={summary}
        editable={editable}
        searchTracks={searchTracks}
        setTying={setIsTyping}
        pageActionType={pageActionType}
        onPageAction={onPageAction}
        onEdited={onEdited}
        onDeleted={onDeleted}
        selectionMode={selectionMode}
        onToggleSelectionMode={onToggleSelectionMode}
      />
    </div>
  );
};

export default memo(Top);
