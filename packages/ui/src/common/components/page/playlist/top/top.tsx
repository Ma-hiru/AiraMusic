import { memo, type FC } from "react";
import { NeteasePlaylist } from "@/common/netease/models";

import TopInfo from "./top-info";
import TopCover from "./top-cover";
import TopRight from "./top-right";

interface TopProps {
  loading: boolean;
  editable: boolean;
  reload?: NormalFunc;
  coverCacheKey?: string;
  selectionMode?: boolean;
  summary: Nullable<NeteasePlaylist>;
  source: Nullable<"like" | "normal">;
  searchTracks: NormalFunc<[k: string]>;
  pageActionType?: "out" | "none" | "enter";
  setIsTyping?: NormalFunc<[tying: boolean]>;
  onAddList: NormalFunc;
  onPlayAll: NormalFunc;
  onDeleted?: NormalFunc;
  onPageAction?: NormalFunc;
  onToggleSelectionMode?: NormalFunc;
  onCoverLoaded?: NormalFunc<[src: string]>;
  onEdited?: Optional<NormalFunc<[modifiedCover: boolean]>>;
}

const Top: FC<TopProps> = ({
  source,
  pageActionType,
  setIsTyping = () => {},
  onEdited,
  onAddList,
  onDeleted,
  onPlayAll,
  onPageAction,
  onCoverLoaded,
  onToggleSelectionMode,
  reload,
  loading,
  summary,
  editable,
  searchTracks,
  coverCacheKey,
  selectionMode
}) => {
  if (loading) return null;
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[3fr_1fr] gap-3">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover summary={summary} coverCacheKey={coverCacheKey} onCoverLoaded={onCoverLoaded} />
        <TopInfo summary={summary} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <TopRight
        reload={reload}
        source={source}
        summary={summary}
        editable={editable}
        setTying={setIsTyping}
        searchTracks={searchTracks}
        selectionMode={selectionMode}
        pageActionType={pageActionType}
        onEdited={onEdited}
        onDeleted={onDeleted}
        onPageAction={onPageAction}
        onToggleSelectionMode={onToggleSelectionMode}
      />
    </div>
  );
};

export default memo(Top);
