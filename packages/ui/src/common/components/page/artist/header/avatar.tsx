import { cx } from "@emotion/css";
import { type FC, memo, type ReactEventHandler, useCallback, useMemo } from "react";
import { NeteaseArtist, NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";
import { NeteaseImageSize } from "@/common/enum";

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
    <div title={artist?.name} className={cx("relative", className)}>
      <NeteaseImage
        cache
        preview
        className="h-full rounded-full aspect-square hover:scale-105 ease-in-out transition-all duration-300"
        image={avatar}
        cacheLazy={false}
        shadow="float"
        onLoad={onLoad}
      />
    </div>
  );
};

export default memo(Avatar);
