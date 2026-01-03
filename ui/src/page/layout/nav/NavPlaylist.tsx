import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { usePlaylistRouter } from "@mahiru/ui/hook/usePlaylistRouter";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { useUserStore } from "@mahiru/ui/store/user";

import NavPlayListItem from "@mahiru/ui/page/layout/nav/NavPlaylistItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";

const NavPlaylist: FC<object> = () => {
  const { stage } = useStage();
  const { mainColor } = useThemeColor();
  const { UserPlaylistSummary, UserFavoriteListsSummary } = useUserStore([
    "UserPlaylistSummary",
    "UserFavoriteListsSummary"
  ]);
  const [fastLocation, setFastLocation] = useState(false);
  const { SideBarOpen, UpdateScrollTop } = useLayoutStore(["SideBarOpen", "UpdateScrollTop"]);
  const { shouldPlaylistIDIs, goToPlaylistPage } = usePlaylistRouter();
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);

  // 用户歌单列表拷贝避免冻结对象
  const [switchPlaylist, setSwitchPlaylist] = useState<"create" | "favorite">("create");
  const getUserPlayLists = useCallback(() => {
    return (switchPlaylist === "create" ? UserPlaylistSummary : UserFavoriteListsSummary) || [];
  }, [UserFavoriteListsSummary, UserPlaylistSummary, switchPlaylist]);

  const isMainColorDark = mainColor.isDark();
  const RowComponent = useCallback<VirtualListRow<NeteasePlaylistSummary, undefined>>(
    (props) => {
      const { index, items } = props;
      const data = items[index]!;
      return (
        <NavPlayListItem
          fastLocation={fastLocation}
          isMainColorDark={isMainColorDark}
          active={shouldPlaylistIDIs(data.id)}
          cover={data.coverImgUrl}
          id={data.id}
          label={data.name}
          count={data.trackCount}
          onClick={goToPlaylistPage}
        />
      );
    },
    [fastLocation, goToPlaylistPage, isMainColorDark, shouldPlaylistIDIs]
  );
  // 滚动处理
  const gotoTop = useCallback((currentItem?: number) => {
    return () => {
      const container = containerRef.current;
      if (container) {
        if (currentItem && currentItem > 50) {
          setFastLocation(true);
          setTimeout(() => setFastLocation(true), Math.floor((currentItem / 10) * 100));
        }
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }, []);
  const onRangeChange = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) {
        UpdateScrollTop({
          type: "userPlaylist",
          callback: gotoTop(range[0])
        });
      } else if (range[0] <= 5) {
        UpdateScrollTop({
          type: "none",
          callback: null
        });
      }
    },
    [UpdateScrollTop, gotoTop]
  );
  useEffect(() => {
    return () => {
      UpdateScrollTop({
        type: "none",
        callback: null
      });
    };
  }, [UpdateScrollTop]);

  const { start, end } = useVirtualList({
    total: getUserPlayLists().length,
    containerRef,
    overscan: 10,
    itemHeight: 55,
    onRangeUpdate: onRangeChange
  });
  const { onScroll } = useScrollAutoHide(containerRef, !SideBarOpen);

  return (
    <div
      className="
        w-full h-full relative overflow-y-auto overflow-x-hidden
        contain-content will-change-scroll scrollbar
      "
      onScroll={onScroll}
      ref={containerRef}>
      {stage >= Stage.Finally && (
        <VirtualList
          RowComponent={RowComponent}
          start={start}
          end={end}
          items={getUserPlayLists()}
          itemHeight={57}
          extraData={undefined}
        />
      )}
    </div>
  );
};
export default memo(NavPlaylist);
