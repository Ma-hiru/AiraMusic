import { type FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";

import NeteaseImage from "@/common/components/image/netease-image";

interface CarouselProps {
  items: { url: string; title?: string }[];
  interval?: number;
  className?: string;
  onClick?: (i: number) => void;
  titleColor?: string;
}

const createCarouselImage = (url: string, title: Optional<string>) => {
  return NeteaseNetworkImage.fromURL(url)
    .setSize(NeteaseImageSize.raw)
    .setAlt(title || "carousel-item");
};

const Carousel: FC<CarouselProps> = ({
  items,
  interval = 3000,
  className,
  onClick,
  titleColor
}) => {
  const [index, setIndex] = useState(0);
  const { mainColor } = useThemeColor();
  const timerRef = useRef<Nullable<number>>(null);
  const activeIndex = items.length ? Math.min(index, items.length - 1) : 0;
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
      />
    );
  }

  return (
    <div
      className={cx(
        `
          relative aspect-[2.55/1] min-h-40 w-full overflow-hidden rounded-xl border
          border-white/15 bg-white/5 shadow-md
        `,
        className
      )}
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}>
      {activeItem && (
        <NeteaseImage
          cache
          pause={!activeItem}
          className="absolute inset-0 scale-110 opacity-35 blur-2xl"
          image={createCarouselImage(activeItem.url, activeItem.title)}
          shadow="none"
        />
      )}
      <div
        className="relative z-10 flex size-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {items.map((item, index) => (
          <div key={index} className="relative h-full w-full shrink-0">
            <NeteaseImage
              cache
              className="size-full cursor-pointer select-none"
              image={createCarouselImage(item.url, item.title || `carousel-item-${index}`)}
              onClick={() => onClick?.(index)}
              shadowColor={mainColor.isDark() ? "dark" : "light"}
            />
          </div>
        ))}
      </div>
      {hasMultipleItems && (
        <>
          <button
            type="button"
            aria-label="上一张"
            className="
              absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer
              items-center justify-center rounded-full bg-black/35 text-white shadow-md
              backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-black/55
              active:scale-90
            "
            onClick={prev}>
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="下一张"
            className="
              absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer
              items-center justify-center rounded-full bg-black/35 text-white shadow-md
              backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-black/55
              active:scale-90
            "
            onClick={next}>
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-3 pt-14">
        <p className="truncate text-sm font-black" style={{ color: titleColor || "#ffffff" }}>
          {activeItem?.title}
        </p>
        {hasMultipleItems && (
          <div className="flex shrink-0 gap-1">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`切换到第 ${i + 1} 张`}
                onClick={() => goTo(i)}
                className={cx(
                  `
                  h-2.5 cursor-pointer rounded-full transition-all duration-300 ease-in-out
                  active:scale-90
                `,
                  i === activeIndex ? "w-6 bg-white" : "w-2.5 bg-white/35 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default memo(Carousel);
