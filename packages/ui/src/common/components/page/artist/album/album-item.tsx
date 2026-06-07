import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { RendererFormat } from "@/common/lib/format";
import RendererImageConstants from "@/common/constants/image";

import NeteaseImage from "@/common/components/display/image/netease-image";

interface AlbumItemProps {
  data: NeteaseAPI.ArtistAlbum;
  onClick: Optional<NormalFunc<[id: number]>>;
}

const AlbumItem: FC<AlbumItemProps> = ({ data, onClick }) => {
  const cover = useMemo(() => {
    return NeteaseNetworkImage.fromURL(data.picUrl)
      .setAlt(data.name)
      .setSize(RendererImageConstants.AlbumListCoverSize);
  }, [data.name, data.picUrl]);
  return (
    <div
      className="w-full h-full text-(--text-color-on-main) flex flex-col justify-center items-center gap-1"
      onClick={onClick?.bind(null, data.id)}>
      <NeteaseImage
        cache
        cacheLazy
        className={`
        w-full aspect-square rounded-md cursor-pointer
        hover:scale-105 transition-transform duration-300 ease-in-out
        active:scale-95
        select-none
        `}
        image={cover}
        shadow="float"
        shadowColor="light"
      />
      <h2 className="text-[12px] opacity-50 text-center ">
        {RendererFormat.time(data.publishTime)}
      </h2>
      <h1 className="font-bold text-base leading-4 text-center line-clamp-1">{data.name}</h1>
    </div>
  );
};

export default memo(AlbumItem);
