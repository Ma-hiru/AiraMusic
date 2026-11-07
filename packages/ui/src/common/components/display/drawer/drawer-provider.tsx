import { X } from "lucide-react";
import { cx } from "@emotion/css";
import { motion, AnimatePresence } from "motion/react";
import {
  memo,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useInject, ensureInjectObject } from "@/common/utils/inject";
import AppModal from "@/common/components/display/modal/use";
import AppContextMenu from "@/common/components/display/menu/use";

import AppDrawer from "./use";

export type DrawerRender = {
  title?: ReactNode;
  className?: string;
  content: ReactNode;
  footer?: ReactNode;
  toggleKey?: string;
  closeOnMask?: boolean;
  contentClassName?: string;
  headerActions?: ReactNode;
  width?: CSSProperties["width"];
  onClose?: NormalFunc<[], void | boolean>;
  resizable?: {
    maxWidth: number;
    minWidth: number;
  };
};

const DrawerProvider: FC<{ className?: string }> = ({ className }) => {
  const [render, setRender] = useState<Nullable<DrawerRender>>(null);
  const [visible, setVisible] = useState(false);
  const [resizedWidth, setResizedWidth] = useState<Nullable<number>>(null);
  const frameRef = useRef<Nullable<HTMLDivElement>>(null);
  const panelRef = useRef<Nullable<HTMLElement>>(null);
  const resizeCleanupRef = useRef<Nullable<NormalFunc>>(null);
  const suppressMaskClickRef = useRef(false);
  const maskClickTimerRef = useRef<Nullable<number>>(null);
  const renderRef = useLatestRef(render);
  const visibleRef = useLatestRef(visible);
  const resizedWidthRef = useLatestRef(resizedWidth);
  const pendingRenderRef = useRef<Nullable<DrawerRender>>(null);
  const exitingRef = useRef(false);

  const setDrawerRenderData: NormalFunc<[data: Nullable<DrawerRender>]> = useCallback(
    (args) => {
      if (!args) {
        pendingRenderRef.current = null;
        if (renderRef.current && (visibleRef.current || exitingRef.current)) {
          exitingRef.current = true;
          setVisible(false);
        } else {
          setRender(null);
        }
        return;
      }
      const current = pendingRenderRef.current ?? (visibleRef.current ? renderRef.current : null);
      if (args.toggleKey && current?.toggleKey === args.toggleKey) {
        pendingRenderRef.current = null;
        exitingRef.current = !!renderRef.current;
        setVisible(false);
        return;
      }
      if (renderRef.current && (visibleRef.current || exitingRef.current)) {
        pendingRenderRef.current = args;
        exitingRef.current = true;
        setVisible(false);
        return;
      }
      setResizedWidth(null);
      setRender(args);
      setVisible(true);
    },
    [renderRef, visibleRef]
  );

  const setDrawerVisible = useCallback(
    (show?: boolean) => {
      const next = show ?? !(visibleRef.current || pendingRenderRef.current);
      if (!next) {
        pendingRenderRef.current = null;
        if (renderRef.current) exitingRef.current = true;
        setVisible(false);
      } else if (!pendingRenderRef.current) {
        if (exitingRef.current && renderRef.current) {
          pendingRenderRef.current = renderRef.current;
        } else {
          setVisible(true);
        }
      }
    },
    [renderRef, visibleRef]
  );

  const getRender = useRef(() => renderRef.current).current;
  const getVisible = useRef(() => visibleRef.current || pendingRenderRef.current !== null).current;

  const finishExit = useCallback(() => {
    exitingRef.current = false;
    const pending = pendingRenderRef.current;
    pendingRenderRef.current = null;
    if (pending) {
      setResizedWidth(null);
      setRender(pending);
      setVisible(true);
    } else if (!visibleRef.current) {
      setRender(null);
      setResizedWidth(null);
    }
  }, [visibleRef]);

  const close = useCallback(() => {
    const result = renderRef.current?.onClose?.();
    setDrawerVisible(typeof result === "boolean" ? result : false);
  }, [renderRef, setDrawerVisible]);

  const stopResize = useCallback(() => {
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = null;
  }, []);

  const clearMaskClickSuppression = useCallback(() => {
    if (maskClickTimerRef.current !== null) window.clearTimeout(maskClickTimerRef.current);
    maskClickTimerRef.current = null;
    suppressMaskClickRef.current = false;
  }, []);

  const getWidthBounds = useCallback((options: NonNullable<DrawerRender["resizable"]>) => {
    const frameWidth = frameRef.current?.getBoundingClientRect().width || window.innerWidth;
    const maxWidth = Math.max(0, Math.min(options.maxWidth, frameWidth - 16));
    const minWidth = Math.max(0, Math.min(options.minWidth, maxWidth));
    return { minWidth, maxWidth };
  }, []);

  const constrainWidth = useCallback(
    (width: number) => {
      const options = renderRef.current?.resizable;
      if (!options) return width;
      const { maxWidth, minWidth } = getWidthBounds(options);
      return Math.max(minWidth, Math.min(width, maxWidth));
    },
    [getWidthBounds, renderRef]
  );

  const getCurrentWidth = useCallback(() => {
    const width = renderRef.current?.width;
    return (
      panelRef.current?.getBoundingClientRect().width ||
      resizedWidthRef.current ||
      (typeof width === "number" ? width : 420)
    );
  }, [renderRef, resizedWidthRef]);

  useEffect(() => {
    if (!visible || !render?.resizable) return;
    const onResize = () => setResizedWidth((width) => constrainWidth(width ?? getCurrentWidth()));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [constrainWidth, getCurrentWidth, render, visible]);

  useEffect(() => {
    return () => {
      stopResize();
      clearMaskClickSuppression();
    };
  }, [clearMaskClickSuppression, render, stopResize, visible]);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !visibleRef.current || !renderRef.current?.resizable) return;
      event.preventDefault();
      event.stopPropagation();
      stopResize();
      clearMaskClickSuppression();

      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startWidth = getCurrentWidth();
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let moved = false;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.setPointerCapture?.(pointerId);

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();
        const delta = startX - event.clientX;
        moved ||= delta !== 0;
        setResizedWidth(constrainWidth(startWidth + delta));
      };
      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        stopResize();
        // 释放时浏览器还会派发 click，避免拖到面板外侧后误触透明遮罩。
        if (moved && event.type === "pointerup") {
          suppressMaskClickRef.current = true;
          maskClickTimerRef.current = window.setTimeout(clearMaskClickSuppression, 0);
        }
      };

      document.addEventListener("pointermove", onPointerMove, { passive: false });
      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", finish);
      window.addEventListener("blur", stopResize);
      handle.addEventListener("lostpointercapture", stopResize);
      resizeCleanupRef.current = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        window.removeEventListener("blur", stopResize);
        handle.removeEventListener("lostpointercapture", stopResize);
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
      };
    },
    [clearMaskClickSuppression, constrainWidth, getCurrentWidth, renderRef, stopResize, visibleRef]
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const options = renderRef.current?.resizable;
      if (!options) return;
      const { maxWidth, minWidth } = getWidthBounds(options);
      let width = getCurrentWidth();
      switch (event.key) {
        case "ArrowLeft":
          width += 16;
          break;
        case "ArrowRight":
          width -= 16;
          break;
        case "Home":
          width = minWidth;
          break;
        case "End":
          width = maxWidth;
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
      setResizedWidth(constrainWidth(width));
    },
    [constrainWidth, getCurrentWidth, getWidthBounds, renderRef]
  );

  useEffect(() => {
    if (!render || (!visible && !exitingRef.current)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (AppModal.__visibleGetter() || AppContextMenu.__contextMenuVisibleGetter()) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, render, visible]);

  useInject(ensureInjectObject(AppDrawer), {
    __setDrawerData: setDrawerRenderData,
    __visibleGetter: getVisible,
    __setDrawerVisible: setDrawerVisible,
    __renderGetter: getRender
  });

  return (
    <div ref={frameRef} className={cx("fixed inset-0 pointer-events-none", className)}>
      <button
        className={cx(
          "absolute inset-0 cursor-default bg-transparent pointer-events-auto",
          !(visible && render) && "hidden"
        )}
        tabIndex={-1}
        type="button"
        aria-label="关闭抽屉遮罩"
        onClick={() => {
          if (suppressMaskClickRef.current) {
            clearMaskClickSuppression();
            return;
          }
          if (render?.closeOnMask ?? true) close();
        }}
      />
      <AnimatePresence mode="sync" onExitComplete={finishExit}>
        {visible && render && (
          <motion.section
            key="drawer"
            ref={panelRef}
            className={cx(
              `
                absolute inset-y-2 right-2 flex w-full max-w-[calc(100%-1rem)] flex-col
                overflow-hidden rounded-xl border border-white/10 pointer-events-auto surface-popover
              `,
              render.className
            )}
            style={{
              width: render.resizable
                ? (resizedWidth ?? render.width ?? 420)
                : (render.width ?? 420)
            }}
            role="dialog"
            aria-modal="false"
            initial={{ x: "100%" }}
            aria-label={typeof render.title === "string" ? render.title : "抽屉"}
            exit={{ x: "100%", transition: { duration: 0.2, ease: "easeInOut" } }}
            animate={{ x: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}>
            {render.resizable && (
              <div
                className="group absolute inset-y-3 left-0 z-10 w-2 cursor-col-resize touch-none outline-none"
                tabIndex={0}
                role="separator"
                aria-label="调整抽屉宽度"
                aria-orientation="vertical"
                aria-valuenow={resizedWidth ?? 420}
                aria-valuemax={render.resizable.maxWidth}
                aria-valuemin={Math.min(render.resizable.minWidth, resizedWidth ?? 420)}
                onKeyDown={handleResizeKeyDown}
                onPointerDown={handleResizeStart}
                onClick={(event) => event.stopPropagation()}>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-primary opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
              </div>
            )}
            <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                {render.title && (
                  <h2 className="truncate text-lg font-bold tracking-normal">{render.title}</h2>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {render.headerActions}
                <button
                  className={`
                  flex size-8 shrink-0 items-center justify-center
                  transition-all duration-300 ease-in-out
                  hover:opacity-50 active:scale-95 cursor-pointer
                `}
                  type="button"
                  aria-label="关闭抽屉"
                  onClick={close}>
                  <X className="size-4" />
                </button>
              </div>
            </header>
            <div
              className={cx(
                "min-h-0 flex-1 overflow-y-auto p-4 scrollbar scrollbar-show",
                render.contentClassName
              )}>
              {render.content}
            </div>
            {render.footer && (
              <footer className="shrink-0 border-t border-white/10 px-4 py-3">
                {render.footer}
              </footer>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(DrawerProvider);
