import { FC, memo, ReactEventHandler, useCallback, useMemo } from "react";
import { NeteaseArtist, NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

interface AvatarProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
}

const Avatar: FC<AvatarProps> = ({ className, artist, onAvatarLoaded }) => {
  const avatar = useMemo(() => {
    if (!artist) return null;
    return NeteaseNetworkImage.fromURL(artist.detail.artist.avatar)
      .setSize(NeteaseImageSize.md)
      .setAlt(artist.detail.artist.name);
  }, [artist]);

  const onLoad: ReactEventHandler<HTMLImageElement> = useCallback(
    (e) => {
      onAvatarLoaded?.(e.currentTarget.src);
    },
    [onAvatarLoaded]
  );

  return (
    <div className={className}>
      <NeteaseImage
        cache
        preview
        className="h-full rounded-full aspect-square"
        image={avatar}
        cacheLazy={false}
        shadow="float"
        onLoad={onLoad}
      />
    </div>
  );
};

export default memo(Avatar);
