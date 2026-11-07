import { createPortal } from "react-dom";
import {
  useId,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useLayoutEffect,
  type CSSProperties,
  type HTMLAttributes
} from "react";

interface UsageTooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "content"> {
  content: ReactNode;
  placement?: "top" | "left";
}

// 聊天内容和输入框都有 overflow 容器，提示放到 body 避免被截断。
const UsageTooltip: FC<UsageTooltipProps> = ({
  content,
  children,
  placement = "top",
  ...props
}) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = popup.getBoundingClientRect();
    const gap = 8;
    let left = anchor.left + (anchor.width - bounds.width) / 2;
    let top = anchor.top - bounds.height - gap;
    if (placement === "left" && anchor.left - bounds.width - gap >= gap) {
      left = anchor.left - bounds.width - gap;
      top = anchor.top + (anchor.height - bounds.height) / 2;
    } else if (top < gap) {
      top = anchor.bottom + gap;
    }
    setPosition({
      left: Math.max(gap, Math.min(left, window.innerWidth - bounds.width - gap)),
      top: Math.max(gap, Math.min(top, window.innerHeight - bounds.height - gap))
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (visible) updatePosition();
  }, [content, updatePosition, visible]);
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition, visible]);

  return (
    <>
      <span
        {...props}
        ref={triggerRef}
        title=""
        tabIndex={0}
        aria-describedby={visible ? id : undefined}
        onBlur={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => {
          if (!triggerRef.current?.contains(document.activeElement)) setVisible(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !visible) return;
          event.stopPropagation();
          setVisible(false);
        }}>
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={popupRef}
            id={id}
            className="pointer-events-none fixed z-110 w-max max-w-[min(18rem,calc(100vw-16px))] rounded-lg border border-white/10 bg-[#111216]/97 px-2.5 py-2 text-[10px] leading-4 text-white/68 shadow-lg shadow-black/30 backdrop-blur-xl"
            style={position ?? { visibility: "hidden" }}
            role="tooltip">
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

export default UsageTooltip;
