import { memo, type FC } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplaySearch } from "@/wins/display/hooks/use-display-search";
import Search from "@/common/components/page/search";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const routerActive = useRouterActive(RoutePathDisplay, "search");
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);
  const { props, searchRef } = useDisplaySearch({ active: routerActive });

  return (
    <Search
      {...props}
      ref={searchRef}
      className="display-container"
      variant="page"
      defaultKeyword={keyword}
    />
  );
};

export default memo(SearchDisplay);
