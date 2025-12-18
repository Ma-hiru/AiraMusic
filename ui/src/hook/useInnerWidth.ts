import { useSyncExternalStore } from "react";

const handlerSet = new Set<NormalFunc>();

function updater() {
  handlerSet.forEach((handler) => handler());
}

window.addEventListener("resize", updater, { passive: true });

export function useInnerWidth() {
  return useSyncExternalStore(
    (update) => {
      handlerSet.add(update);
      return () => {
        handlerSet.delete(update);
      };
    },
    () => window.innerWidth
  );
}
