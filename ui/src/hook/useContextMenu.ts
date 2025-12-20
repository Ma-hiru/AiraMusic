import { usePlayerStatus } from "@mahiru/ui/store";
import { useEffect } from "react";

export function useContextMenu() {
  const { getContextMenuRenderer, getContextMenuVisibleSetter, contextMenuVisible } =
    usePlayerStatus([
      "getContextMenuRenderer",
      "getContextMenuVisibleSetter",
      "contextMenuVisible"
    ]);
  const setContextMenuRenderer = getContextMenuRenderer?.();
  const setContextMenuVisible = getContextMenuVisibleSetter?.();

  useEffect(() => {
    const close = (e: MouseEvent | UIEvent | Event) => {
      if (!contextMenuVisible) return;
      setContextMenuVisible?.(false);
    };
    window.addEventListener("resize", close, {
      passive: true
    });
    window.addEventListener("click", close, {
      passive: true
    });
    window.addEventListener("scroll", close, {
      passive: true
    });
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close);
    };
  }, [contextMenuVisible, setContextMenuVisible]);

  useEffect(() => {
    return () => {
      setContextMenuRenderer?.(null);
      setContextMenuVisible?.(false);
    };
  }, [setContextMenuRenderer, setContextMenuVisible]);

  return {
    setContextMenuRenderer,
    setContextMenuVisible,
    contextMenuVisible
  };
}
