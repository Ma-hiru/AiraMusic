import { FC, memo, useCallback, useRef, useState } from "react";
import Avatar from "@mahiru/ui/page/layout/componets/Avatar";
import NavSideNavItem from "@mahiru/ui/page/layout/componets/NavSideNavItem";
import { ArrowBigUp } from "lucide-react";
import NavSideDivider from "@mahiru/ui/page/layout/componets/NavSideDivider";
import NavSidePlayListItem from "@mahiru/ui/page/layout/componets/NavSidePlayListItem";
import { css, cx } from "@emotion/css";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useNavigate, useLocation, NavigateFunction, Location } from "react-router-dom";
import { List, RowComponentProps, ListImperativeAPI } from "react-window";
import { NeteasePlaylistSummary } from "@mahiru/ui/types/netease-api";
import { NAV_DATA } from "@mahiru/ui/router";

const NavSide: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const navigate = useNavigate();
  const location = useLocation();
  /** Scroll */
  const listElement = useRef<ListImperativeAPI>(null);
  const [showRestScroll, setShowRestScroll] = useState(false);
  const scrollReset = useCallback(() => {
    const list = listElement.current;
    if (list) {
      list.scrollToRow({
        align: "start",
        behavior: "smooth",
        index: 0
      });
    }
  }, []);

  return (
    <div className="absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 bg-[#f0f3f6] z-0">
      <div className="py-8">
        <Avatar />
      </div>
      {/*nav*/}
      <div className="space-y-4">
        {NAV_DATA.map(({ icon, label, path }) => {
          return (
            <NavSideNavItem
              key={label}
              prefix={icon}
              active={location.pathname === path}
              onClick={() => navigate(path)}>
              {label}
            </NavSideNavItem>
          );
        })}
      </div>
      {!!data?.userPlayLists?.length && <NavSideDivider />}
      {/*playList*/}
      <div className="overflow-hidden">
        <div
          className={cx(
            "overflow-y-auto relative w-full h-full",
            css`
              scrollbar-width: none;
            `
          )}>
          <List
            listRef={listElement}
            rowComponent={Row}
            className={cx(css`
              scrollbar-width: none;
            `)}
            rowCount={data.userPlayLists.length}
            rowHeight={55}
            onRowsRendered={({ startIndex }) => setShowRestScroll(startIndex > 5)}
            overscanCount={5}
            rowProps={{
              playLists: data.userPlayLists,
              navigate,
              location
            }}
          />
        </div>
        <button
          className={cx(
            "absolute bottom-22 right-4 text-[#fc3d49] bg-black/5 rounded-full p-1 cursor-pointer backdrop-blur-2xl ease-in-out transition-opacity",
            !showRestScroll && "opacity-0"
          )}
          aria-label="回到顶部"
          onClick={scrollReset}>
          <ArrowBigUp />
        </button>
      </div>
    </div>
  );
};
export default memo(NavSide);

function Row(
  props: RowComponentProps<{
    playLists: NeteasePlaylistSummary[];
    navigate: NavigateFunction;
    location: Location;
  }>
) {
  const { index, style, playLists, navigate, location } = props;
  const playList = playLists[index]!;
  return (
    <div style={style}>
      <NavSidePlayListItem
        active={location.pathname === `/playlist/${playList.id}`}
        key={playList.id}
        cover={playList.coverImgUrl}
        id={playList.id}
        label={playList.name}
        count={playList.trackCount}
        onClick={(id) => navigate(`/playlist/${id}`)}
      />
    </div>
  );
}
