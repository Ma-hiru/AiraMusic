import { useCallback, useSyncExternalStore } from "react";

const defaultTitle = document.title;

export function useWindowTitle() {
  const windowTitle = useSyncExternalStore(
    (update) => {
      const observer = new MutationObserver(update);
      const titleElement = document.querySelector("title");
      titleElement && observer.observe(titleElement, { childList: true });
      return () => observer.disconnect();
    },
    () => document.title
  );
  const updateWindowTitle = useCallback((title: string) => {
    document.title = title;
  }, []);
  return {
    windowTitle,
    updateWindowTitle,
    defaultTitle
  };
}
