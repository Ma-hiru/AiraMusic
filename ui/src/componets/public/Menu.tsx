import {
  FC,
  memo,
  ReactNode,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@emotion/css";

type MenuDivider = {
  type: "divider";
  key?: string | number;
};

type MenuAction = {
  type?: "action";
  key: string | number;
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export type MenuItem = MenuAction | MenuDivider;

interface MenuProps {
  items: MenuItem[];
  children: ReactNode;
  className?: string;
  menuClassName?: string;
  closeOnItemClick?: boolean;
}

const Menu: FC<MenuProps> = ({
  items,
  children,
  className,
  menuClassName,
  closeOnItemClick = true
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState({ visible: false, x: 0, y: 0, adjusted: false });

  const closeMenu = useCallback(() => {
    setMenuState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const openMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuState({ visible: true, x: event.clientX, y: event.clientY, adjusted: false });
  }, []);

  useEffect(() => {
    if (!menuState.visible) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("contextmenu", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("contextmenu", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuState.visible]);

  useLayoutEffect(() => {
    if (!menuState.visible || !menuRef.current || menuState.adjusted) return;
    const rect = menuRef.current.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    let x = menuState.x;
    let y = menuState.y;
    if (x + rect.width > innerWidth) x = Math.max(0, innerWidth - rect.width - 8);
    if (y + rect.height > innerHeight) y = Math.max(0, innerHeight - rect.height - 8);
    setMenuState((prev) => ({ ...prev, x, y, adjusted: true }));
  }, [menuState.adjusted, menuState.visible, menuState.x, menuState.y]);

  const renderedMenu = useMemo(() => {
    if (typeof document === "undefined" || !menuState.visible) return null;
    return createPortal(
      <div
        ref={menuRef}
        className={cx(
          "fixed z-[1000] min-w-40 rounded-md border border-black/10 bg-white/95 p-1 shadow-2xl backdrop-blur-md text-sm select-none",
          menuClassName
        )}
        style={{ top: menuState.y, left: menuState.x }}
        role="menu">
        {items.map((item, index) => {
          if (item.type === "divider") {
            return <div key={item.key ?? `divider-${index}`} className="my-1 h-px bg-black/10" />;
          }
          const disabled = !!item.disabled;
          const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            if (disabled) return;
            item.onClick?.();
            if (closeOnItemClick) closeMenu();
          };
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={handleClick}
              className={cx(
                "flex w-full items-center gap-2 rounded px-3 py-2 text-left transition-colors",
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-black/5 active:bg-black/10 cursor-pointer",
                item.danger && !disabled && "text-red-500"
              )}>
              {item.prefix && <span className="text-base text-black/70">{item.prefix}</span>}
              <span className="flex-1 truncate">{item.label}</span>
              {item.suffix && <span className="text-base text-black/40">{item.suffix}</span>}
            </button>
          );
        })}
      </div>,
      document.body
    );
  }, [
    closeMenu,
    closeOnItemClick,
    items,
    menuClassName,
    menuState.visible,
    menuState.x,
    menuState.y
  ]);

  return (
    <div ref={triggerRef} onContextMenu={openMenu} className={className}>
      {children}
      {renderedMenu}
    </div>
  );
};

export default memo(Menu);
