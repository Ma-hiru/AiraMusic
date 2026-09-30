import { useCallback, useSyncExternalStore } from "react";
import { RendererWindow } from "@/common/lib/window";

/** Electron 关闭了后台节流，必须同时检查 IPC 窗口状态和页面可见性。 */
export function useWindowVisible() {
  const currentWindow = RendererWindow.current;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const remove = currentWindow.addListener(onChange);
      document.addEventListener("visibilitychange", onChange);
      return () => {
        remove();
        document.removeEventListener("visibilitychange", onChange);
      };
    },
    [currentWindow]
  );
  const snapshot = useCallback(
    () => currentWindow.isShow && !currentWindow.isMin && document.visibilityState === "visible",
    [currentWindow]
  );
  return useSyncExternalStore(subscribe, snapshot);
}
