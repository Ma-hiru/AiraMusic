import { FC, memo, useCallback, useRef, useState } from "react";
import { ArrowBigUp } from "lucide-react";
import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import NavSidePlayListItem from "@mahiru/ui/page/layout/nav/NavListItem";
import { css, cx } from "@emotion/css";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import CachedProvider from "@mahiru/ui/ctx/CachedProvider";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { NeteasePlaylistSummary } from "@mahiru/ui/types/netease-api";

const NavSide: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const navigate = useNavigate();
  const location = useLocation();
  /** Scroll */
  const scrollElement = useRef<VirtuosoHandle>(null);
  const [showRestScroll, setShowRestScroll] = useState(false);

  const scrollReset = useCallback(
    () => scrollElement.current?.scrollToIndex({ index: 0, behavior: "smooth" }),
    []
  );
  const handleScroll = useCallback(
    (range: { startIndex: number }) => setShowRestScroll(range.startIndex > 10),
    []
  );

  const RowComponent = useCallback(
    (_: number, data: NeteasePlaylistSummary) => (
      <NavSidePlayListItem
        active={location.pathname === `/playlist/${data.id}`}
        cover={data.coverImgUrl}
        id={data.id}
        label={data.name}
        count={data.trackCount}
        onClick={(id) => navigate(`/playlist/${id}`)}
      />
    ),
    [navigate, location.pathname]
  );
  return (
    <div className="absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 bg-[#f0f3f6] z-0">
      <div className="py-8">
        <CachedProvider>
          <Avatar />
        </CachedProvider>
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
          <CachedProvider>
            {data.userPlayLists.length > 200 ? (
              <Virtuoso<NeteasePlaylistSummary>
                ref={scrollElement}
                className={cx(css`
                  scrollbar-width: none;
                `)}
                rangeChanged={handleScroll}
                data={data.userPlayLists}
                overscan={5}
                itemContent={RowComponent}
              />
            ) : (
              data.userPlayLists.map((item) => {
                return (
                  <NavSidePlayListItem
                    key={item.id}
                    active={location.pathname === `/playlist/${item.id}`}
                    cover={item.coverImgUrl}
                    id={item.id}
                    label={item.name}
                    count={item.trackCount}
                    onClick={(id) => navigate(`/playlist/${id}`)}
                  />
                );
              })
            )}
          </CachedProvider>
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
