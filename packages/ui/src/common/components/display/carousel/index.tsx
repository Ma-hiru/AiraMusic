import { cx } from "@emotion/css";
import { clamp } from "lodash-es";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppLoading from "@/common/components/fallback/app-loading";

import Cover from "./cover";
import Indicator from "./indicator";
import FloatButton from "./float-button";

interface CarouselProps {
  empty?: boolean;
  interval?: number;
  className?: string;
  onClick?: (i: number) => void;
  items: { url: string; title?: string }[];
}

const Carousel: FC<CarouselProps> = ({
  className,
  onClick,
  items,
  empty = false,
  interval = 3000
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
            aspect-[2.55/1] min-h-40 w-full animate-pulse rounded-xl surface-1
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
          relative aspect-[2.55/1] min-h-40 w-full overflow-hidden rounded-xl surface-1
        `,
        className
      )}
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}>
      <Cover items={items} activeIndex={activeIndex} onClick={onClick} />
      {hasMultipleItems && <FloatButton next={next} prev={prev} />}
      <Indicator
        length={items.length}
        activeIdx={activeIndex}
        title={activeItem?.title}
        showDot={hasMultipleItems}
        onDotClick={goTo}
      />
    </section>
  );
};

export default memo(Carousel);
