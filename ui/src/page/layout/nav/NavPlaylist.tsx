import { FC, memo, useCallback, useEffect, useRef } from "react";
import { useLayoutStatus, usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useLocation, useNavigate } from "react-router-dom";
import NavPlayListItem from "@mahiru/ui/page/layout/nav/NavPlaylistItem";
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { getPlaylistRouterPath } from "@mahiru/ui/hook/usePlaylistRouter";

const NavPlaylist: FC<object> = () => {
  const { userPlaylistSummary } = usePersistZustandShallowStore(["userPlaylistSummary"]);
  const { requestCanScrollTop, sideBarOpen } = useLayoutStatus([
    "requestCanScrollTop",
    "sideBarOpen"
  ]);
  const { mainColor } = useThemeColor();
  const userPlayListRef = useRef<NeteasePlaylistSummary[]>([]);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const userPlayLists = userPlayListRef.current;
  const updater = useUpdate();
  const navigate = useNavigate();
  const location = useLocation();

  const gotoTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);
  const isMainColorDark = mainColor.isDark();
  const RowComponent = useCallback<VirtualListRow<NeteasePlaylistSummary, undefined>>(
    (props) => {
      const { index, items } = props;
      const data = items[index]!;
      return (
        <NavPlayListItem
          index={index}
          isMainColorDark={isMainColorDark}
          rawList={userPlayLists}
          active={location.pathname === `/playlist/${data.id}`}
          cover={{
            raw: data.coverImgUrl,
            cached: data.cachedCoverImgUrl,
            cacheID: data.cachedCoverImgUrlID
          }}
          id={data.id}
          label={data.name}
          count={data.trackCount}
          onClick={(id) => navigate(getPlaylistRouterPath(id, "playlist"))}
        />
      );
    },
    [isMainColorDark, location.pathname, navigate, userPlayLists]
  );
  const onRangeChange = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) {
        requestCanScrollTop("userPlaylist", gotoTop);
      } else if (range[0] <= 5) {
        requestCanScrollTop("none");
      }
    },
    [gotoTop, requestCanScrollTop]
  );

  const { start, end } = useVirtualList({
    total: userPlayLists.length,
    containerRef,
    overscan: 10,
    itemHeight: 55,
    onRangeUpdate: onRangeChange
  });
  const { onScroll } = useScrollAutoHide(containerRef, !sideBarOpen);

  useEffect(() => {
    if (userPlaylistSummary) {
      userPlayListRef.current = structuredClone(userPlaylistSummary);
      updater();
    }
  }, [updater, userPlaylistSummary]);
  useEffect(() => {
    return () => {
      requestCanScrollTop("none");
    };
  }, [requestCanScrollTop]);
  return (
    <div
      className="
        w-full h-full relative overflow-y-auto overflow-x-hidden
        contain-content will-change-scroll scrollbar
      "
      onScroll={onScroll}
      ref={containerRef}>
      <VirtualList
        RowComponent={RowComponent}
        start={start}
        end={end}
        items={userPlayLists}
        itemHeight={57}
        extraData={undefined}
      />
    </div>
  );
};
export default memo(NavPlaylist);
