import { cx } from "@emotion/css";
import { createPortal } from "react-dom";
import {
  memo,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type AriaRole,
  type ReactNode,
  type FocusEvent,
  useLayoutEffect,
  type KeyboardEvent,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent
} from "react";

const TOOLTIP_PLACEMENT_CLASS = {
  top: {
    base: "bottom-full left-1/2 -translate-x-1/2 pb-3",
    closed: "translate-y-2",
    open: "translate-y-0",
    hover: "group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0"
  },
  bottom: {
    base: "top-full left-1/2 -translate-x-1/2 pt-3",
    closed: "-translate-y-2",
    open: "translate-y-0",
    hover: "group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0"
  },
  left: {
    base: "right-full top-1/2 -translate-y-1/2 pr-3",
    closed: "translate-x-2",
    open: "translate-x-0",
    hover: "group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0"
  },
  right: {
    base: "left-full top-1/2 -translate-y-1/2 pl-3",
    closed: "-translate-x-2",
    open: "translate-x-0",
    hover: "group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0"
  }
} as const;

type TooltipPlacement = keyof typeof TOOLTIP_PLACEMENT_CLASS;

const focusableElements = (container: ParentNode) =>
  Array.from(
    container.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[hidden], [inert]") &&
      element.getClientRects().length > 0
  );

interface TooltipProps extends Omit<HTMLAttributes<HTMLElement>, "content"> {
  portal?: boolean;
  content: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  interactive?: boolean;
  tooltipLabel?: string;
  tooltipRole?: AriaRole;
  popupClassName?: string;
  placement?: TooltipPlacement;
}

const Tooltip: FC<TooltipProps> = ({
  className,
  onBlur,
  onFocus,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onMouseDownCapture,
  content,
  children,
  tooltipLabel,
  popupClassName,
  portal = false,
  disabled = false,
  placement = "top",
  interactive = false,
  tooltipRole = "tooltip",
  ...props
}) => {
  const [holding, setHolding] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [anchorRect, setAnchorRect] = useState<Nullable<DOMRect>>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasContent = !disabled && content !== null && content !== undefined && content !== false;
  const placementClass = TOOLTIP_PLACEMENT_CLASS[placement];
  const portalOpen = portal && hasContent && (hovered || focused || holding);

  const containsTarget = useCallback((target: null | EventTarget) => {
    return (
      target instanceof Node &&
      (triggerRef.current?.contains(target) || popupRef.current?.contains(target))
    );
  }, []);

  const handleMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      onMouseEnter?.(event);
      setHovered(true);
    },
    [onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      onMouseLeave?.(event);
      if (!containsTarget(event.relatedTarget)) setHovered(false);
    },
    [containsTarget, onMouseLeave]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event);
      setFocused(true);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onBlur?.(event);
      if (!containsTarget(event.relatedTarget)) setFocused(false);
    },
    [containsTarget, onBlur]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event);
      if (
        event.defaultPrevented ||
        event.key !== "Tab" ||
        !interactive ||
        !popupRef.current ||
        !triggerRef.current
      )
        return;

      const triggerItems = focusableElements(triggerRef.current);
      const popupItems = focusableElements(popupRef.current);
      const lastTrigger = triggerItems.at(-1);
      const firstPopup = popupItems[0];
      const lastPopup = popupItems.at(-1);
      let nextTarget: undefined | HTMLElement;

      if (!event.shiftKey && event.target === lastTrigger) nextTarget = firstPopup;
      if (event.shiftKey && event.target === firstPopup) nextTarget = lastTrigger;
      if (!event.shiftKey && event.target === lastPopup && lastTrigger) {
        const outsideItems = focusableElements(document.body).filter(
          (element) => !popupRef.current?.contains(element)
        );
        nextTarget = outsideItems[outsideItems.indexOf(lastTrigger) + 1];
      }
      if (!nextTarget) return;
      event.preventDefault();
      nextTarget.focus();
    },
    [interactive, onKeyDown]
  );

  const handleMouseDownCapture = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      onMouseDownCapture?.(event);
      if (!interactive || event.defaultPrevented) return;
      setHolding(true);
    },
    [interactive, onMouseDownCapture]
  );

  useEffect(() => {
    if (!holding) return;

    const release = () => setHolding(false);
    window.addEventListener("mouseup", release, { once: true });
    window.addEventListener("blur", release, { once: true });

    return () => {
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", release);
    };
  }, [holding]);

  useLayoutEffect(() => {
    if (!portalOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect(rect);
    };
    const close = () => {
      setHovered(false);
      setFocused(false);
      setHolding(false);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("blur", close);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    if (triggerRef.current) observer?.observe(triggerRef.current);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("blur", close);
    };
  }, [portalOpen]);

  return (
    <section
      {...props}
      ref={triggerRef}
      className={cx("group/tooltip relative inline-flex", className)}
      onBlur={portal ? handleBlur : onBlur}
      onFocus={portal ? handleFocus : onFocus}
      onMouseDownCapture={handleMouseDownCapture}
      onKeyDown={portal ? handleKeyDown : onKeyDown}
      onMouseEnter={portal ? handleMouseEnter : onMouseEnter}
      onMouseLeave={portal ? handleMouseLeave : onMouseLeave}>
      {children}
      {hasContent && !portal && (
        <div
          className={cx(
            `
              pointer-events-none absolute z-50 opacity-0
              transition-all duration-300 ease-in-out
              group-hover/tooltip:opacity-100
              group-focus-within/tooltip:opacity-100
            `,
            interactive &&
              "group-hover/tooltip:pointer-events-auto group-focus-within/tooltip:pointer-events-auto",
            placementClass.base,
            placementClass.closed,
            placementClass.hover,
            holding && "pointer-events-auto opacity-100",
            holding && placementClass.open,
            popupClassName
          )}
          role={tooltipRole}
          aria-label={tooltipLabel}>
          {content}
        </div>
      )}
      {portalOpen &&
        anchorRect &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50"
            style={{
              left: anchorRect.left,
              top: anchorRect.top,
              width: anchorRect.width,
              height: anchorRect.height
            }}>
            <div
              ref={popupRef}
              className={cx(
                "absolute opacity-100",
                interactive ? "pointer-events-auto" : "pointer-events-none",
                placementClass.base,
                placementClass.open,
                popupClassName
              )}
              role={tooltipRole}
              aria-label={tooltipLabel}>
              {content}
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};

export default memo(Tooltip);
