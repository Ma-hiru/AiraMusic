import { FC, memo, useCallback, useRef, useState } from "react";
import { css, cx } from "@emotion/css";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowBigUp } from "lucide-react";
import NavPlayListItem from "@mahiru/ui/page/layout/nav/NavPlayListItem";
import { useVirtualList, RowComponentType } from "@mahiru/ui/hook/useVirtualList";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

const NavPlayList: FC<object> = () => {
  const { getUserPlayListSummaryStatic } = useDynamicZustandShallowStore([
    "getUserPlayListSummaryStatic",
    "_static_update"
  ]);
  const userPlayLists = getUserPlayListSummaryStatic();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const [showTopBtn, setShowTopBtn] = useState(false);

  const { onScroll, onScrollEnd } = useScrollAutoHide(containerRef);
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
  const gotoTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);
  const List = useVirtualList({
    items: userPlayLists,
    containerRef,
    overscan: 10,
    itemHeight: 55,
    onRangeUpdate: onRangeChange
  });
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
  return (
    <div className="overflow-hidden">
      <div
        onScroll={onScroll}
        onScrollEnd={onScrollEnd}
        ref={containerRef}
        className={cx(
          "overflow-y-auto relative w-full h-full contain-content will-change-scroll scrollbar",
          css`
            -webkit-overflow-scrolling: auto;
          `
        )}>
        <List RowComponent={RowComponent} />
      </div>
      <button
        className={cx(
          "absolute bottom-22 right-4 text-[#fc3d49] bg-black/5 rounded-full p-1 cursor-pointer backdrop-blur-2xl hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all",
          !showTopBtn && "opacity-0"
        )}
        onClick={gotoTop}
        aria-label="回到顶部">
        <ArrowBigUp />
      </button>
    </div>
  );
};
export default memo(NavPlayList);
