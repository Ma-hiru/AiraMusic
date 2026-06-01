import { type FC, memo } from "react";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";

import NeteaseImage from "@/common/components/image/netease-image";

interface CoverProps {
  activeIndex: number;
  onClick?: NormalFunc<[idx: number]>;
  items: { url: string; title?: string }[];
}

const createCarouselImage = (url: string, title: Optional<string>) => {
  return NeteaseNetworkImage.fromURL(url)
    .setSize(NeteaseImageSize.raw)
    .setAlt(title || url);
};

const Cover: FC<CoverProps> = ({ activeIndex, onClick, items }) => {
  return (
    <section
      className="relative z-10 flex size-full transition-transform duration-500 ease-in-out"
      style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
      {items.map((item, index) => (
        <div key={index} className="relative h-full w-full shrink-0">
          <NeteaseImage
            cache
            className="size-full cursor-pointer select-none"
            image={createCarouselImage(item.url, item.title || `carousel-item-${index}`)}
            onClick={() => onClick?.(index)}
          />
        </div>
      ))}
    </section>
  );
};

export default memo(Cover);
