import { Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useRef, useCallback, type RefObject } from "react";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useDisplaySearch } from "@/wins/display/hooks/use-display-search";
import IconButton from "@/common/components/data-input/icon-button";
import PageSearch, { type SearchRef } from "@/common/components/page/search";
import AppDrawer, { createSearchDrawer } from "@/common/components/display/drawer";

const SearchControl = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { create } = AppDrawer.useDrawer();
  const searchRef = useRef<Nullable<SearchRef>>(null);
  const open = useCallback(() => {
    create(createSearchDrawer, {
      content: <DisplaySearchDrawerContent searchRef={searchRef} />,
      onPageAction: () => {
        const keyword = searchRef.current?.currentKeyword.trim();
        navigate(RoutePath.withQuery(RoutePathDisplay.search, keyword ? { keyword } : {}));
      }
    });
  }, [create, navigate]);

  if (location.pathname === RoutePathDisplay.search) return null;
  return <IconButton label="搜索" icon={Search} size="compact" variant="plain" onClick={open} />;
};

const DisplaySearchDrawerContent = ({
  searchRef
}: {
  searchRef: RefObject<Nullable<SearchRef>>;
}) => {
  const { props } = useDisplaySearch({
    searchRef,
    routerActive: false,
    onJumpPage: AppDrawer.close
  });
  return <PageSearch {...props} ref={searchRef} variant="drawer" />;
};

export default memo(SearchControl);
