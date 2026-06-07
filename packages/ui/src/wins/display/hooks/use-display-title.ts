import { useEffect, useState } from "react";
import { RoutePathDisplay } from "@/common/routes";
import { useRouterActive } from "@/common/hooks/use-router-active";

export function useDisplayTitle(page: keyof typeof RoutePathDisplay) {
  const active = useRouterActive(RoutePathDisplay, page);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!active) return;
    if (!name) {
      document.title = `${import.meta.env.APP_NAME}`;
    } else {
      document.title = `${import.meta.env.APP_NAME} - ${name}`;
    }
  }, [active, name]);

  return {
    updateTitle: setName,
    active
  };
}
