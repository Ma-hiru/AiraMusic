import { useEffect } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

export function useContextMenu() {
  const { ContextMenu } = useLayoutStore(["ContextMenu"]);
  const setContextMenuRenderer = ContextMenu.rendererGetter?.();
  const setContextMenuVisible = ContextMenu.visibleSetter?.();

  useEffect(() => {
    const close = () => {
      if (!ContextMenu.visible) return;
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
  }, [ContextMenu.visible, setContextMenuVisible]);

  useEffect(() => {
    return () => {
      setContextMenuRenderer?.(null);
      setContextMenuVisible?.(false);
    };
  }, [setContextMenuRenderer, setContextMenuVisible]);

  return {
    setContextMenuRenderer,
    setContextMenuVisible,
    contextMenuVisible: ContextMenu.visible
  };
}
