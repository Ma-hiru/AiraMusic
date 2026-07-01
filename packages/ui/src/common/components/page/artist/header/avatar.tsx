import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useCallback, type ReactEventHandler } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseArtist, NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface AvatarProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
}

const Avatar: FC<AvatarProps> = ({ className, onAvatarLoaded, artist }) => {
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
    <div className={cx("relative", className)} title={artist?.name}>
      <NeteaseImage
        className="h-full rounded-full aspect-square hover:scale-105 ease-in-out transition-all duration-300"
        image={avatar}
        shadow="float"
        cacheLazy={false}
        onLoad={onLoad}
        cache
        preview
      />
    </div>
  );
};

export default memo(Avatar);
