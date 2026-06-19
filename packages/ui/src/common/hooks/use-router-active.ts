import { RoutePath } from "@/common/routes";
import { PlaylistPathUtils } from "@/common/routes/utils";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export function useRouterActive<T extends RoutePath<any>>(route: T, page: keyof T) {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const target = route[page];
    // playlist 键是 PlaylistPathUtils 实例而非字符串路径，需取其 base
    const pathname = target instanceof PlaylistPathUtils ? target.base : (target as string);
    setActive(route.matchPathname(location, pathname));
  }, [location, page, route]);

  return active;
}
