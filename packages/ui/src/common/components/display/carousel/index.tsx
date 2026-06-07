import { type FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { clamp } from "lodash-es";

import Indicator from "./indicator";
import FloatButton from "./float-button";
import Cover from "./cover";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppLoading from "@/common/components/fallback/app-loading";

interface CarouselProps {
  items: { url: string; title?: string }[];
  interval?: number;
  className?: string;
  onClick?: (i: number) => void;
  empty?: boolean;
}

const Carousel: FC<CarouselProps> = ({
  items,
  interval = 3000,
  className,
  onClick,
  empty = false
}) => {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<Nullable<number>>(null);
  const activeIndex = clamp(index, 0, items.length - 1);
  const activeItem = items[activeIndex];
  const hasMultipleItems = items.length > 1;

  const next = useCallback(() => {
    if (!items.length) return;
    setIndex((prevState) => (prevState + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    if (!items.length) return;
    setIndex((prevState) => (prevState - 1 + items.length) % items.length);
  }, [items.length]);

  const stopAutoPlay = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    if (items.length <= 1) return;
    timerRef.current = window.setInterval(next, interval);
  }, [interval, items.length, next, stopAutoPlay]);

  const goTo = useCallback(
    (i: number) => {
      if (!items.length) return;
      setIndex(i % items.length);
    },
    [items.length]
  );

  useEffect(() => {
    if (!hasMultipleItems) return stopAutoPlay;
    startAutoPlay();
    return stopAutoPlay;
  }, [hasMultipleItems, startAutoPlay, stopAutoPlay]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (!items.length) {
    return (
      <div
        className={cx(
          `
            aspect-[2.55/1] min-h-40 w-full animate-pulse rounded-xl border border-white/15
            bg-white/5 shadow-md
          `,
          className
        )}
        children={empty ? <AppEmpty /> : <AppLoading loading />}
      />
    );
  }

  return (
    <section
      className={cx(
        `
          relative aspect-[2.55/1] min-h-40 w-full overflow-hidden rounded-xl border
          border-white/15 bg-white/5 shadow-md
        `,
        className
      )}
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}>
      <Cover items={items} onClick={onClick} activeIndex={activeIndex} />
      {hasMultipleItems && <FloatButton next={next} prev={prev} />}
      <Indicator
        title={activeItem?.title}
        showDot={hasMultipleItems}
        activeIdx={activeIndex}
        length={items.length}
        onDotClick={goTo}
      />
    </section>
  );
};

export default memo(Carousel);
