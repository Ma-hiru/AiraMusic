import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage } from "../../../../source/netease/models";
import { FormatNumber } from "../../../../lib/format";
import ImageConstants from "@mahiru/ui/common/constants/image";

import NeteaseImage from "../../../../components/image/NeteaseImage";

interface AlbumItemProps {
  data: NeteaseAPI.ArtistAlbum;
  onClick: Optional<NormalFunc<[id: number]>>;
}

const AlbumItem: FC<AlbumItemProps> = ({ data, onClick }) => {
  const cover = useMemo(() => {
    return NeteaseNetworkImage.fromURL(data.picUrl)
      .setAlt(data.name)
      .setSize(ImageConstants.AlbumListCoverSize);
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
      <h2 className="text-[12px] opacity-50 text-center ">{FormatNumber.time(data.publishTime)}</h2>
      <h1 className="font-bold text-base leading-4 text-center line-clamp-1">{data.name}</h1>
    </div>
  );
};

export default memo(AlbumItem);
