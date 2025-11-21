import { FC, memo, useCallback, useRef } from "react";
import { css, cx } from "@emotion/css";
import { NeteasePlaylistSummary } from "@mahiru/ui/types/netease-api";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowBigUp } from "lucide-react";
import CachedProvider from "@mahiru/ui/ctx/CachedProvider";
import NavPlayListItem from "@mahiru/ui/page/layout/nav/NavPlayListItem";
import { useVirtualList, RowComponentType } from "@mahiru/ui/hook/useVirtualList";

const NavPlayList: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const navigate = useNavigate();
  const location = useLocation();
  const RowComponent = useCallback<RowComponentType<NeteasePlaylistSummary>>(
    (props) => {
      const { index, items } = props;
      const data = items[index]!;
      return (
        <NavPlayListItem
          active={location.pathname === `/playlist/${data.id}`}
          cover={data.coverImgUrl}
          id={data.id}
          label={data.name}
          count={data.trackCount}
          onClick={(id) => navigate(`/playlist/${id}`)}
        />
      );
    },
    [navigate, location.pathname]
  );
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const List = useVirtualList(data.userPlayLists, containerRef, 10, 55);
  return (
    <div className="overflow-hidden">
      <div
        ref={containerRef}
        className={cx(
          "overflow-y-auto relative w-full h-full contain-content will-change-scroll",
          css`
            scrollbar-width: none;
            -webkit-overflow-scrolling: auto;
          `
        )}>
        <CachedProvider>
          <List RowComponent={RowComponent} />
        </CachedProvider>
      </div>
      <button
        className={cx(
          "absolute bottom-22 right-4 text-[#fc3d49] bg-black/5 rounded-full p-1 cursor-pointer backdrop-blur-2xl ease-in-out transition-opacity",
          "opacity-0"
        )}
        aria-label="回到顶部">
        <ArrowBigUp />
      </button>
    </div>
  );
};
export default memo(NavPlayList);
