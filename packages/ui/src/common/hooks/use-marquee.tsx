import { type RefObject, useEffect } from "react";

type MarqueeOpts = {
  /** 像素/秒 单位，默认 30 */
  speed?: number;
  /** 如果为 true，用 ping-pong（往返）模式；否则到末尾后瞬回起点并继续 */
  pingPong?: boolean;
  /** 悬停时是否暂停 */
  pauseOnHover?: boolean;
  /** 到达端点后的停留时长（ms） */
  gapDuration?: number;
};

/**
 * 跑马灯：对容器内第一个子元素做 translateX 动画。
 *
 * 要求容器 overflow-hidden、内容包裹在单个行内块子元素中。
 * 动画用 WAAPI 交给合成器执行，没有逐帧 JS 开销；内容放得下时不启动。
 * 尺寸或内容变化由 ResizeObserver 触发重建（observe 时会立即回调一次，无需手动初始化）。
 */
export function useMarquee(containerRef: RefObject<Nullable<HTMLElement>>, opts: MarqueeOpts = {}) {
  const { speed = 30, pingPong = true, pauseOnHover = true, gapDuration = 1000 } = opts;

  useEffect(() => {
    const container = containerRef.current;
    const inner = container?.firstElementChild;
    if (!container || !(inner instanceof HTMLElement)) return;

    let animation: Nullable<Animation> = null;
    let hovering = false;

    const rebuild = () => {
      animation?.cancel();
      animation = null;
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

      animation = inner.animate(keyframes, { duration: total, iterations: Infinity });
      if (hovering) animation.pause();
    };

    const onMouseEnter = () => {
      hovering = true;
      animation?.pause();
    };
    const onMouseLeave = () => {
      hovering = false;
      animation?.play();
    };
    if (pauseOnHover) {
      container.addEventListener("mouseenter", onMouseEnter);
      container.addEventListener("mouseleave", onMouseLeave);
    }

    const observer = new ResizeObserver(rebuild);
    observer.observe(container);
    observer.observe(inner);

    return () => {
      observer.disconnect();
      if (pauseOnHover) {
        container.removeEventListener("mouseenter", onMouseEnter);
        container.removeEventListener("mouseleave", onMouseLeave);
      }
      animation?.cancel();
    };
  }, [containerRef, speed, pingPong, pauseOnHover, gapDuration]);
}
