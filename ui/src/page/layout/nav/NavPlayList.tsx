import { FC, memo, useCallback, useRef, useState } from "react";
import { css, cx } from "@emotion/css";
import { NeteasePlaylistSummary } from "@mahiru/ui/types/netease-api";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowBigUp } from "lucide-react";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";
import NavPlayListItem from "@mahiru/ui/page/layout/nav/NavPlayListItem";
import { useVirtualList, RowComponentType } from "@mahiru/ui/hook/useVirtualList";

const NavPlayList: FC<object> = () => {
  const { getUserPlayListSummaryStatic, _update } = useDynamicZustandShallowStore([
    "getUserPlayListSummaryStatic",
    "_update"
  ]);
  const userPlayLists = getUserPlayListSummaryStatic();
  const navigate = useNavigate();
  const location = useLocation();
  const RowComponent = useCallback<RowComponentType<NeteasePlaylistSummary>>(
    (props) => {
      const { index, items } = props;
      const data = items[index]!;
      return (
        <NavPlayListItem
          index={index}
          active={location.pathname === `/playlist/${data.id}`}
          cover={{
            raw: data.coverImgUrl,
            cached: data.cachedCoverImgUrl,
            cacheID: data.cachedCoverImgUrlID
          }}
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
  const [showTopBtn, setShowTopBtn] = useState(false);
  const onRangeChange = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5 && !showTopBtn) {
        setShowTopBtn(true);
      } else if (range[0] <= 5 && showTopBtn) {
        setShowTopBtn(false);
      }
    },
    [showTopBtn]
  );
  const List = useVirtualList(userPlayLists, containerRef, 10, 55, undefined, onRangeChange);
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
        <BlobCachedProvider key={_update}>
          <List RowComponent={RowComponent} />
        </BlobCachedProvider>
      </div>
      <button
        className={cx(
          "absolute bottom-22 right-4 text-[#fc3d49] bg-black/5 rounded-full p-1 cursor-pointer backdrop-blur-2xl ease-in-out transition-opacity",
          !showTopBtn && "opacity-0"
        )}
        aria-label="回到顶部">
        <ArrowBigUp />
      </button>
    </div>
  );
};
export default memo(NavPlayList);
