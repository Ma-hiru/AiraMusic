import { useSyncExternalStore } from "react";

export function useInnerWidth() {
  return useSyncExternalStore(
    (update) => {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    },
    () => window.innerWidth
  );
}
