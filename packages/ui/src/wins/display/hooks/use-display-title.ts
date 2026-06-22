import { useCallback, useEffect, useRef } from "react";
import { type Location, useLocation } from "react-router-dom";

const titles = new Map<string, string>();
const buildKey = (location: Location) => location.pathname + location.search;

export function useDisplayTitleRegister() {
  const location = useLocation();
  const remove = useRef<Nullable<NormalFunc>>(null);

  const registerTitle = useCallback(
    (title: string) => {
      remove.current?.();
      const key = buildKey(location);
      titles.set(key, title);

      window.document.title = title;

      remove.current = () => {
        titles.delete(key);
        remove.current = null;
      };
      return remove.current;
    },
    [location]
  );

  useEffect(() => {
    return () => {
      remove.current?.();
    };
  }, []);

  return {
    registerTitle
  };
}

export function useDisplayTitle() {
  const current = buildKey(useLocation());
  useEffect(() => {
    window.document.title = titles.get(current) ?? import.meta.env.APP_NAME;
  }, [current]);
}
