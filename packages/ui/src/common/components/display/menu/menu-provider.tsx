import { cx } from "@emotion/css";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { motion, useAnimate } from "motion/react";
import {
  memo,
  useRef,
  type FC,
  type Key,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useLayoutEffect,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useInject, ensureInjectObject } from "@/common/utils/inject";

import AppContextMenu from "./use";

const DURATION = 0.15;
/** 子菜单宽度，用于判断是否需要向左翻转 */
const SUBMENU_WIDTH = 176;

export type ContextMenuItem = {
  id?: Key;
  label?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** 分组分隔线，其余字段会被忽略 */
  separator?: boolean;
  /** 危险操作，红色呈现且不套用主色 hover */
  danger?: boolean;
  disabled?: boolean;
  /** 子菜单；存在时该行只负责展开，不触发 onClick */
  onClick?: () => void;
  children?: ContextMenuItem[];
};

export type ContextMenuRender = {
  clientX: number;
  clientY: number;
  header?: ReactNode;
  items: ContextMenuItem[];
};

const MenuProvider: FC<{ className?: string }> = ({ className }) => {
  const [scope, animate] = useAnimate();
  const [visible, setVisible] = useState(false);
  const [render, setRender] = useState<Nullable<ContextMenuRender>>(null);
  // 子菜单挂到 body：父级带 backdrop-filter 会成为 backdrop root，嵌套后采样不到页面内容
  const [submenu, setSubmenu] =
    useState<Nullable<{ key: string; top: number; left: number; items: ContextMenuItem[] }>>(null);
  const listRef = useRef<Nullable<HTMLDivElement>>(null);
  const submenuRef = useRef<Nullable<HTMLDivElement>>(null);
  const submenuCloseTimer = useRef<Nullable<number>>(null);
  const previousFocus = useRef<Nullable<HTMLElement>>(null);
  const keyboardOpening = useRef(false);

  const setContextMenuRenderData = setRender;

  const setContextMenuVisible = useCallback((show?: boolean) => {
    if (typeof show === "boolean") {
      setVisible(show);
    } else {
      setVisible((v) => !v);
    }
  }, []);

  const cancelSubmenuClose = useCallback(() => {
    if (submenuCloseTimer.current == null) return;
    window.clearTimeout(submenuCloseTimer.current);
    submenuCloseTimer.current = null;
  }, []);

  const closeSubmenu = useCallback(() => {
    cancelSubmenuClose();
    setSubmenu(null);
  }, [cancelSubmenuClose]);

  // 鼠标从父行移到浮层之间有一段空隙，延迟关闭留出穿过的时间
  const scheduleSubmenuClose = useCallback(() => {
    cancelSubmenuClose();
    submenuCloseTimer.current = window.setTimeout(() => {
      submenuCloseTimer.current = null;
      setSubmenu(null);
    }, 160);
  }, [cancelSubmenuClose]);

  const openSubmenu = useCallback(
    (key: string, element: HTMLElement, items: ContextMenuItem[]) => {
      cancelSubmenuClose();
      const rect = element.getBoundingClientRect();
      const estimated = items.length * 28 + 8;
      const flipX = rect.right + SUBMENU_WIDTH + 8 > window.innerWidth;
      const flipY = rect.bottom + estimated > window.innerHeight - 8;
      setSubmenu({
        key,
        items,
        left: flipX ? Math.max(8, rect.left - SUBMENU_WIDTH - 4) : rect.right + 4,
        top: Math.max(8, flipY ? rect.bottom - estimated : rect.top)
      });
    },
    [cancelSubmenuClose]
  );

  const openContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: 1, scale: 1, pointerEvents: "auto" },
      { duration: DURATION, ease: "easeOut" }
    );
  }, [animate, scope]);

  const moveContextMenu = useCallback(
    async (x: number, y: number) => {
      const menu = scope.current;
      if (!menu) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth;

      let left = x;
      let top = y;

      if (x + mw > vw) {
        left = x - mw;
      }
      if (y + mh > vh) {
        top = y - mh;
      }

      const padding = 8;
      // left + mw <= vw - padding
      // padding <= left
      left = Math.max(padding, Math.min(left, vw - mw - padding));
      top = Math.max(padding, Math.min(top, vh - mh - padding));

      const originX = x + mw > vw ? "right" : "left";
      const originY = y + mh > vh ? "bottom" : "top";

      menu.style.transformOrigin = `${originX} ${originY}`;
      await animate(menu, { left, top }, { duration: 0 });
    },
    [animate, scope]
  );

  const closeContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: 0, scale: 0.96, pointerEvents: "none" },
      { duration: DURATION, ease: "easeIn" }
    );
  }, [animate, scope]);

  useLayoutEffect(() => {
    if (!render) {
      return;
    }
    if (visible) {
      closeContextMenuAnimate()
        .then(() => moveContextMenu(render.clientX, render.clientY))
        .then(openContextMenuAnimate);
    } else {
      void closeContextMenuAnimate();
    }
  }, [closeContextMenuAnimate, moveContextMenu, openContextMenuAnimate, render, visible]);

  // 打开时把焦点移入菜单，关闭时归还，避免焦点停在已隐藏的按钮上误触
  useEffect(() => {
    if (!visible) {
      const previous = previousFocus.current;
      previousFocus.current = null;
      if (previous && document.contains(previous)) previous.focus();
      return;
    }
    previousFocus.current = document.activeElement as Nullable<HTMLElement>;
    // 只把焦点交给菜单容器：既不留下高亮的首项，又能让方向键与 Esc 生效
    const timer = window.setTimeout(() => {
      listRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [visible]);

  // 展开子菜单后按需把焦点送进去（仅键盘触发时）
  useEffect(() => {
    if (!submenu || !keyboardOpening.current) return;
    keyboardOpening.current = false;
    submenuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus();
  }, [submenu]);

  // 关闭时清空子菜单，避免下次打开残留
  useEffect(() => {
    if (!visible) setSubmenu(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setContextMenuVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setContextMenuVisible, visible]);

  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const list = event.currentTarget;
      const buttons = Array.from(
        list.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).filter((button) => button.closest('[role="menu"]') === list && !button.disabled);
      if (!buttons.length) return;
      const current =
        document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
      const index = current ? buttons.indexOf(current) : -1;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          buttons[(index + 1) % buttons.length]?.focus();
          break;
        case "ArrowUp":
          event.preventDefault();
          buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
          break;
        case "ArrowRight": {
          const key = current?.dataset["submenuKey"];
          if (!current || !key) return;
          const node = render?.items[Number(key.split("-")[1])];
          if (!node?.children?.length) return;
          event.preventDefault();
          keyboardOpening.current = true;
          openSubmenu(key, current, node.children);
          break;
        }
        case "ArrowLeft": {
          if (!current || !submenuRef.current?.contains(current) || !submenu) return;
          event.preventDefault();
          const parentKey = submenu.key;
          closeSubmenu();
          listRef.current
            ?.querySelector<HTMLButtonElement>(`button[data-submenu-key="${parentKey}"]`)
            ?.focus();
          break;
        }
        default:
          break;
      }
    },
    [closeSubmenu, openSubmenu, render?.items, submenu]
  );

  const visibleRef = useLatestRef(visible);
  useInject(ensureInjectObject(AppContextMenu), {
    __setContextMenuData: setContextMenuRenderData,
    __setContextMenuVisible: setContextMenuVisible,
    __contextMenuVisibleGetter: useRef(() => visibleRef.current).current
  });

  const renderItems = (items: ContextMenuItem[], depth: number): ReactNode =>
    items.map((item, index) => {
      const key = `${depth}-${index}`;
      if (item.separator) {
        return (
          <div
            key={key}
            className="mx-1 h-px shrink-0 bg-white/10"
            role="separator"
            aria-orientation="horizontal"
          />
        );
      }
      const hasChildren = !!item.children?.length;
      const opened = submenu?.key === key;
      const button = (
        <button
          key={key}
          className={cx(
            `
              flex w-full items-center gap-1.5
              rounded-md border-0 bg-transparent px-2 py-1 text-left
              outline-none transition-colors duration-300 ease-in-out
              focus-visible:ring-2
            `,
            item.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
            item.danger
              ? `text-red-400 hover:bg-red-500/90 hover:text-white
                 focus-visible:bg-red-500/90 focus-visible:text-white focus-visible:ring-red-400/60`
              : `hover:bg-primary hover:text-primary-text
                 focus-visible:bg-primary focus-visible:text-primary-text focus-visible:ring-primary/60`
          )}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={visible ? 0 : -1}
          aria-expanded={hasChildren ? opened : undefined}
          aria-haspopup={hasChildren ? "menu" : undefined}
          data-submenu-key={hasChildren ? key : undefined}
          onMouseEnter={(event) => {
            if (hasChildren) openSubmenu(key, event.currentTarget, item.children!);
            else if (depth === 0) closeSubmenu();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren || item.disabled) return;
            item.onClick?.();
            setContextMenuVisible(false);
          }}>
          {!!item.prefix && item.prefix}
          {item.label}
          {!!item.suffix && item.suffix}
          {hasChildren && (
            <ChevronRight
              className={cx("size-3.5 shrink-0 opacity-45", !item.suffix && "ml-auto")}
            />
          )}
        </button>
      );
      if (!hasChildren) return button;
      return (
        <div
          key={key}
          className="relative"
          onMouseEnter={cancelSubmenuClose}
          onMouseLeave={scheduleSubmenuClose}>
          {button}
        </div>
      );
    });

  return (
    <motion.div
      ref={scope}
      className={cx(
        `
          fixed z-(--z-index-context-menu) w-46 rounded-md
          surface-popover p-1 contain-layout
          pointer-events-none opacity-0 shadow-none!
      `,
        className
      )}
      aria-hidden={!visible}>
      {!!render?.header && (
        <>
          <div className="px-1 h-10">{render.header}</div>
          <div className="mx-2 my-1 h-px bg-neutral-700/10" />
        </>
      )}
      <div
        ref={listRef}
        className="flex flex-col space-y-1 outline-none"
        role="menu"
        tabIndex={-1}
        aria-label="上下文菜单"
        onKeyDown={handleListKeyDown}>
        {render?.items && renderItems(render.items, 0)}
      </div>
      {submenu &&
        createPortal(
          <div
            className={cx("fixed z-(--z-index-context-menu) w-44", className)}
            style={{ left: submenu.left, top: submenu.top }}
            onMouseEnter={cancelSubmenuClose}
            onMouseLeave={scheduleSubmenuClose}>
            <div className="surface-popover rounded-md p-1">
              <div
                ref={submenuRef}
                className="flex flex-col space-y-1 outline-none"
                role="menu"
                aria-label="子菜单"
                onKeyDown={handleListKeyDown}>
                {renderItems(submenu.items, 1)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </motion.div>
  );
};
export default memo(MenuProvider);
