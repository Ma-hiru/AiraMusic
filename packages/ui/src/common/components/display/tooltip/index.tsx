import { cx } from "@emotion/css";
import {
  type AriaRole,
  type FC,
  type HTMLAttributes,
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState
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

interface TooltipProps extends Omit<HTMLAttributes<HTMLElement>, "content"> {
  content: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  popupClassName?: string;
  disabled?: boolean;
  interactive?: boolean;
  tooltipRole?: AriaRole;
  tooltipLabel?: string;
}

const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  placement = "top",
  popupClassName,
  className,
  disabled = false,
  interactive = false,
  tooltipRole = "tooltip",
  tooltipLabel,
  onMouseDownCapture,
  ...props
}) => {
  const [holding, setHolding] = useState(false);
  const hasContent = !disabled && content !== null && content !== undefined && content !== false;
  const placementClass = TOOLTIP_PLACEMENT_CLASS[placement];

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

  return (
    <section
      {...props}
      className={cx("group/tooltip relative inline-flex", className)}
      onMouseDownCapture={handleMouseDownCapture}>
      {children}
      {hasContent && (
        <div
          role={tooltipRole}
          aria-label={tooltipLabel}
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
          )}>
          {content}
        </div>
      )}
    </section>
  );
};

export default memo(Tooltip);
