import { RoutePath } from "@/common/routes";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export function useRouterActive<T extends RoutePath<any>>(route: T, page: keyof T) {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(route.matchPathname(location, route[page] as string));
  }, [location, page, route]);

  return active;
}
