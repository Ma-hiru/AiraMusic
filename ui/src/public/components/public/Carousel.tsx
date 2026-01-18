import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

interface CarouselProps {
  items: { url: string; title?: string }[];
  interval?: number;
  className?: string;
  onClick?: (i: number) => void;
  titleColor?: string;
}

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

  const next = useCallback(() => {
    setIndex((prevState) => (prevState + 1) % items.length);
  }, [items.length]);
  const prev = useCallback(() => {
    setIndex((prevState) => (prevState - 1 + items.length) % items.length);
  }, [items.length]);
  const stopAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);
  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    timerRef.current = window.setInterval(next, interval);
  }, [interval, next, stopAutoPlay]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i % items.length);
    },
    [items.length]
  );

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, [startAutoPlay, stopAutoPlay]);

  return (
    <div
      className={cx("relative w-full flex items-center justify-center mb-5", className)}
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}>
      <div className="w-[89%] h-[89%] flex justify-center overflow-hidden">
        <div
          className="w-full flex transition-transform duration-300 ease-in-out rounded-md"
          style={{ transform: `translateX(-${index * 100}%)` }}>
          {items.map((item, index) => (
            <div key={index} className="w-full shrink-0 flex-col relative">
              <NeteaseImage
                className="w-full h-full select-none rounded-md"
                src={item.url}
                size={NeteaseImageSize.raw}
                alt={item.title || `carousel-item-${index}`}
                onClick={() => onClick?.(index)}
                shadowColor={mainColor.isDark() ? "dark" : "light"}
              />
            </div>
          ))}
        </div>
      </div>
      <button
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full shadow-md hover:bg-black/60 transition-all ease-in-out duration-300 cursor-pointer active:scale-90"
        onClick={prev}>
        <ChevronLeft />
      </button>
      <button
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full shadow-md hover:bg-black/60 transition-all ease-in-out duration-300 cursor-pointer active:scale-90"
        onClick={next}>
        <ChevronRight />
      </button>
      <div className="absolute -bottom-4 flex justify-between items-center w-[90%] left-1/2 -translate-x-1/2 flex-row-reverse">
        <p
          className="font-semibold text-[14px] text-center"
          style={{ color: titleColor || "#ffffff" }}>
          {items[index]?.title}
        </p>
        <div className="flex gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cx(
                "w-3 h-3 rounded-full transition-all ease-in-out duration-300 cursor-pointer active:scale-90",
                i === index ? "bg-white" : "bg-white/30 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
export default memo(Carousel);
