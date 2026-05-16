import {
  memo,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

export interface VirtualScrollbarProps {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  contentHeight: number;
  minThumbHeight?: number;
  offsetRight?: number;
  offsetY?: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const VirtualScrollbar = ({
  containerRef,
  contentHeight,
  minThumbHeight = 24,
  offsetRight = 2,
  offsetY = 4
}: VirtualScrollbarProps) => {
  const [thumbState, setThumbState] = useState({ height: 0, offset: 0 });
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number>(0);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, scrollTop: 0 });

  const updateThumb = useMemo(() => {
    return () => {
      const container = containerRef.current;
      if (!container) return;
      const viewport = container.clientHeight;
      if (viewport <= 0 || contentHeight <= viewport) {
        setThumbState({ height: 0, offset: 0 });
        return;
      }
      const track = Math.max(0, viewport - offsetY * 2);
      const height = clamp((viewport / contentHeight) * track, minThumbHeight, track);
      const maxOffset = Math.max(track - height, 0);
      const maxScroll = contentHeight - viewport;
      const offset =
        maxScroll > 0 ? clamp((container.scrollTop / maxScroll) * maxOffset, 0, maxOffset) : 0;
      setThumbState({ height, offset });
    };
  }, [containerRef, contentHeight, minThumbHeight, offsetY]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => updateThumb());
    resizeObserver.observe(container);
    updateThumb();
    const onScroll = () => {
      updateThumb();
      setVisible(true);
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 800);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", onScroll);
      window.clearTimeout(hideTimerRef.current);
    };
  }, [containerRef, updateThumb]);

  useEffect(() => {
    updateThumb();
  }, [contentHeight, updateThumb]);

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const viewport = container.clientHeight;
      const track = Math.max(0, viewport - offsetY * 2);
      const height = thumbState.height;
      const maxOffset = Math.max(track - height, 0);
      const maxScroll = contentHeight - viewport;
      if (maxOffset <= 0 || maxScroll <= 0) return;
      const delta = ev.clientY - dragStartRef.current.y;
      const nextOffset = clamp(
        (dragStartRef.current.scrollTop / maxScroll) * maxOffset + delta,
        0,
        maxOffset
      );

      container.scrollTop = (nextOffset / maxOffset) * maxScroll;
    };
    const onUp = () => {
      draggingRef.current = false;
      setVisible(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    if (draggingRef.current) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [containerRef, contentHeight, offsetY, thumbState.height]);

  const onThumbPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    draggingRef.current = true;
    dragStartRef.current = { y: ev.clientY, scrollTop: container.scrollTop };
    setVisible(true);
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  const show = visible || draggingRef.current;
  const thumbStyle = {
    height: `${thumbState.height}px`,
    transform: `translateY(${thumbState.offset + offsetY}px)`
  };

  const shouldRender = thumbState.height > 0;

  return shouldRender ? (
    <div
      className={`virtual-scrollbar ${show ? "virtual-scrollbar--show" : ""}`}
      style={{ right: offsetRight }}>
      <div className="virtual-scrollbar__track">
        <div
          className="virtual-scrollbar__thumb"
          style={thumbStyle}
          onPointerDown={onThumbPointerDown}
        />
      </div>
    </div>
  ) : null;
};

export default memo(VirtualScrollbar);
