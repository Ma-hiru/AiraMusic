import { useRef, useEffect, type RefObject } from "react";
import { useUpdate } from "@/common/hooks/use-update";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useWindowVisible } from "@/common/hooks/use-window-visible";

export type MarqueeOpts = {
  /** 像素/秒 单位，默认 30 */
  speed?: number;
  /** 如果为 true，用 ping-pong（往返）模式；否则到末尾后瞬回起点并继续 */
  pingPong?: boolean;
  /** 悬停时是否暂停 */
  pauseOnHover?: boolean;
  /** 到达端点后的停留时长（ms） */
  gapDuration?: number;
  /** 是否暂停 */
  pause?: boolean;
  /** 是否禁用 */
  disable?: boolean;
};

/**
 * 跑马灯：对容器内第一个子元素做 translateX 动画。
 *
 * 要求容器 overflow-hidden、内容包裹在单个行内块子元素中。
 * 动画用 WAAPI 交给合成器执行，没有逐帧 JS 开销；内容放得下时不启动。
 * 尺寸或内容变化由 ResizeObserver 触发重建（observe 时会立即回调一次，无需手动初始化）。
 */
export function useMarquee(containerRef: RefObject<Nullable<HTMLElement>>, opts: MarqueeOpts = {}) {
  const {
    pause,
    disable,
    speed = 30,
    pingPong = true,
    gapDuration = 1000,
    pauseOnHover = true
  } = opts;
  const animationRef = useRef<Nullable<Animation>>(null);
  const hoveringRef = useRef(false);
  const visible = useWindowVisible();
  const pauseRef = useLatestRef(pause || !visible);
  const update = useUpdate();

  useEffect(() => {
    if (disable) return; // 禁用时停止动画

    const container = containerRef.current;
    const inner = container?.firstElementChild;
    if (!container || !(inner instanceof HTMLElement)) return;

    const observer = new ResizeObserver(() => {
      animationRef.current?.cancel();
      animationRef.current = null;
      const distance = inner.scrollWidth - container.clientWidth;
      if (distance <= 0) return;

      const travel = (distance / speed) * 1000;
      const total = pingPong ? (travel + gapDuration) * 2 : travel + gapDuration;
      // 关键帧内的 easing 作用于该帧到下一帧的区间，端点间用 ease-in-out 平滑起停。
      const keyframes: Keyframe[] = pingPong
        ? [
            { transform: "translateX(0)", offset: 0, easing: "ease-in-out" },
            { transform: `translateX(${-distance}px)`, offset: travel / total },
            {
              transform: `translateX(${-distance}px)`,
              offset: (travel + gapDuration) / total,
              easing: "ease-in-out"
            },
            { transform: "translateX(0)", offset: (travel * 2 + gapDuration) / total },
            { transform: "translateX(0)", offset: 1 }
          ]
        : [
            { transform: "translateX(0)", offset: 0, easing: "ease-in-out" },
            { transform: `translateX(${-distance}px)`, offset: travel / total },
            { transform: `translateX(${-distance}px)`, offset: 1 }
          ];

      animationRef.current = inner.animate(keyframes, { duration: total, iterations: Infinity });
      if (hoveringRef.current || pauseRef.current) animationRef.current.pause();
    });
    observer.observe(container);
    observer.observe(inner);

    return () => {
      observer.disconnect();
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [containerRef, speed, pingPong, pauseOnHover, gapDuration, update.count, disable, pauseRef]);

  useEffect(() => {
    if (disable || !pauseOnHover) return;
    const container = containerRef.current;
    if (!container) return;

    const onMouseEnter = () => {
      hoveringRef.current = true;
      animationRef.current?.pause();
    };
    const onMouseLeave = () => {
      hoveringRef.current = false;
      !pauseRef.current && animationRef.current?.play();
    };
    container.addEventListener("mouseenter", onMouseEnter);
    container.addEventListener("mouseleave", onMouseLeave);
    return () => {
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      hoveringRef.current = false;
    };
  }, [containerRef, disable, pauseOnHover, pauseRef]);

  useEffect(() => {
    if (disable) return; // 禁用时停止动画
    if (visible && !pause && !hoveringRef.current) {
      animationRef.current?.play();
    } else {
      animationRef.current?.pause();
    }
  }, [disable, pause, visible]);

  return {
    update
  };
}
