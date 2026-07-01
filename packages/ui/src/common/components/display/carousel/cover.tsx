import { memo, type FC } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface CoverProps {
  activeIndex: number;
  items: { url: string; title?: string }[];
  onClick?: NormalFunc<[idx: number]>;
}

const createCarouselImage = (url: string, title: Optional<string>) => {
  return NeteaseNetworkImage.fromURL(url)
    .setSize(NeteaseImageSize.raw)
    .setAlt(title || url);
};

const Cover: FC<CoverProps> = ({ onClick, items, activeIndex }) => {
  return (
    <section
      className="relative z-10 flex size-full transition-transform duration-500 ease-in-out"
      style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
      {items.map((item, index) => (
        <div key={index} className="relative h-full w-full shrink-0">
          <NeteaseImage
            className="size-full cursor-pointer select-none"
            image={createCarouselImage(item.url, item.title || `carousel-item-${index}`)}
            onClick={() => onClick?.(index)}
            cache
          />
        </div>
      ))}
    </section>
  );
};

export default memo(Cover);
