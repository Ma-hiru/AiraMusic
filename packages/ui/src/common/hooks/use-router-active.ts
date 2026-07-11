import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath } from "@/common/routes";

/** 匹配页面路由，不包含 query */
export function useRouterActive<T extends RoutePath<any>>(route: T, page: keyof T) {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(route.matchPathname(location, route[page] as string));
  }, [location, page, route]);

  return active;
}
