import { RefObject, useEffect, useRef } from "react";

type Opts = {
  /** 像素/秒 单位，默认 50 */
  speed?: number;
  /** 是否在 mount 时自动启动 */
  auto?: boolean;
  /** 如果为 true，用 ping-pong（往返）模式；否则到末尾后瞬回起点并继续 */
  pingPong?: boolean;
  /** 悬停时是否暂停 */
  pauseOnHover?: boolean;
  gapDuration?: number;
};

export function useManualAutoScroll(
  containerRef: RefObject<Nullable<HTMLElement>>,
  opts: Opts = {}
) {
  const {
    speed = 50,
    auto = true,
    pingPong = true,
    pauseOnHover = true,
    gapDuration = 1000
  } = opts;
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({
    running: false,
    paused: false,
    dir: 1, // 1 向右（增大 scrollLeft），-1 向左
    lastTs: 0,
    pos: 0
  });

  // 计算并开始/停止逻辑
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    function calcAndMaybeStart() {
      const max = (el?.scrollWidth || 0) - (el?.clientWidth || 0);
      if (max <= 0) {
        stop();
        return;
      }
      // 初始化位置如果溢出，确保 pos 在合法范围
      stateRef.current.pos = Math.max(0, Math.min(el?.scrollLeft || 0, max));
      if (auto) start();
    }

    function onMouseEnter() {
      if (pauseOnHover) pause();
    }
    function onMouseLeave() {
      if (pauseOnHover) resume();
    }

    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mouseleave", onMouseLeave);

    // Detect size/content changes to recalc
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(calcAndMaybeStart);
      resizeObserver.observe(el);
      // also observe children
      Array.from(el.children).forEach((c) => resizeObserver!.observe(c as Element));
    } else {
      // @ts-expect-error
      window.addEventListener("resize", calcAndMaybeStart);
    }

    // mutationObserver to catch text/content change
    mutationObserver = new MutationObserver(calcAndMaybeStart);
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });

    // initial calc
    // slight delay to allow fonts/images to layout
    const tid = window.setTimeout(calcAndMaybeStart, 50);

    return () => {
      clearTimeout(tid);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mouseleave", onMouseLeave);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", calcAndMaybeStart);
      }
      if (mutationObserver) mutationObserver.disconnect();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  const gapTimer = useRef<Nullable<number>>(null);

  function animate(ts: number) {
    const el = containerRef.current;
    if (!el) return;

    if (!stateRef.current.lastTs) {
      stateRef.current.lastTs = ts;
    }
    const dt = ts - stateRef.current.lastTs; // ms
    stateRef.current.lastTs = ts;

    if (!stateRef.current.running || stateRef.current.paused) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) {
      // nothing to scroll
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // px to move this frame
    const delta = (speed * dt) / 1000; // speed px per second
    let nextPos = stateRef.current.pos + stateRef.current.dir * delta;

    if (pingPong) {
      if (nextPos >= max) {
        if (!gapTimer.current) {
          // 到达末尾，停顿
          nextPos = max;
          el.scrollLeft = Math.round(nextPos);
          gapTimer.current = window.setTimeout(() => {
            stateRef.current.dir = -1;
            gapTimer.current = null;
          }, gapDuration);
          rafRef.current = requestAnimationFrame(animate);
          return;
        }
        nextPos = max; // 等待间隔时保持末尾
      } else if (nextPos <= 0) {
        if (!gapTimer.current) {
          nextPos = 0;
          el.scrollLeft = Math.round(nextPos);
          gapTimer.current = window.setTimeout(() => {
            stateRef.current.dir = 1;
            gapTimer.current = null;
          }, gapDuration);
          rafRef.current = requestAnimationFrame(animate);
          return;
        }
        nextPos = 0;
      } else {
        // loop 风格
        if (nextPos >= max) {
          if (!gapTimer.current) {
            nextPos = max;
            el.scrollLeft = Math.round(nextPos);
            gapTimer.current = window.setTimeout(() => {
              nextPos = 0;
              stateRef.current.pos = 0;
              gapTimer.current = null;
            }, gapDuration);
            rafRef.current = requestAnimationFrame(animate);
            return;
          }
          nextPos = max;
        } else if (nextPos <= 0) {
          nextPos = 0;
        }
      }
    }

    stateRef.current.pos = nextPos;
    // 设置 scrollLeft（直接设置比 scrollTo({behavior:"smooth"}) 更可控）
    el.scrollLeft = Math.round(nextPos);

    rafRef.current = requestAnimationFrame(animate);
  }

  function start() {
    if (stateRef.current.running) return;
    stateRef.current.running = true;
    stateRef.current.lastTs = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }

  function stop() {
    stateRef.current.running = false;
    stateRef.current.lastTs = 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function pause() {
    stateRef.current.paused = true;
  }

  function resume() {
    stateRef.current.paused = false;
    // reset timestamp so we don't jump
    stateRef.current.lastTs = 0;
  }

  function jumpToStart() {
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    stateRef.current.pos = 0;
  }

  function jumpToEnd() {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollLeft = Math.max(0, max);
    stateRef.current.pos = el.scrollLeft;
  }

  return {
    start,
    stop,
    pause,
    resume,
    jumpToStart,
    jumpToEnd
  };
}
