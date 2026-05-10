import { FC, memo } from "react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/public/routes";
import { useLocation } from "react-router-dom";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);

  return (
    <div className="w-full h-full text-(--text-color-on-main)">search - keyword: {keyword}</div>
  );
};

export default memo(SearchDisplay);
