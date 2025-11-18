import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@mahiru/ui/page/layout/componets/Avatar";
import NavSideNavItem from "@mahiru/ui/page/layout/componets/NavSideNavItem";
import { ArrowBigUp, Clock, House, Star } from "lucide-react";
import NavSideDivider from "@mahiru/ui/page/layout/componets/NavSideDivider";
import NavSidePlayListItem from "@mahiru/ui/page/layout/componets/NavSidePlayListItem";
import { css, cx } from "@emotion/css";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useNavigate, useLocation } from "react-router-dom";

const NAV = [
  { icon: <House className="w-full" />, label: "推荐", path: "/home" },
  { icon: <Star className="w-full" />, label: "搜藏", path: "/start" },
  { icon: <Clock className="w-full" />, label: "历史", path: "/history" }
];

const NavSide: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const navigate = useNavigate();
  const location = useLocation();
  /** Scroll */
  const listElement = useRef<HTMLDivElement>(null);
  const [showRestScroll, setShowRestScroll] = useState(false);
  const scrollReset = useCallback(() => {
    const list = listElement.current;
    if (list) {
      list.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);
  useEffect(() => {
    const list = listElement.current;
    if (!list) return;
    const onScroll = () => {
      if (list.scrollTop > 100) {
        setShowRestScroll(true);
      } else {
        setShowRestScroll(false);
      }
    };
    list.addEventListener("scroll", onScroll);
    return () => {
      list.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <div className="absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 bg-[#f0f3f6] z-0">
      <div className="py-8">
        <Avatar />
      </div>
      {/*nav*/}
      <div className="space-y-4">
        {NAV.map(({ icon, label, path }) => {
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
      {data?.userPlayLists?.length && <NavSideDivider />}
      {/*playList*/}
      <div className="overflow-hidden">
        <div
          ref={listElement}
          className={cx(
            "overflow-y-auto relative w-full h-full pb-4 space-y-2",
            css`
              scrollbar-width: none;
            `
          )}>
          {data?.userPlayLists?.map((playList) => {
            return (
              <NavSidePlayListItem
                active={location.pathname === `/playlist/${playList.id}`}
                key={playList.id}
                cover={playList.coverImgUrl}
                id={playList.id}
                label={playList.name}
                count={playList.trackCount}
                onClick={(id) => navigate(`/playlist/${id}`)}
              />
            );
          })}
          <span className="text-[10px] text-[#7b8290] text-center block mt-2">
            一共 {data.userPlayLists.length} 个歌单
          </span>
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
