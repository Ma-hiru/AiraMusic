import { useEffect, useRef } from "react";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";

export function useMediaSession(props: {
  play: NormalFunc<any>;
  lastTrack: NormalFunc<any>;
  nextTrack: NormalFunc<any>;
  info: PlayerTrackInfo;
}) {
  const { play, lastTrack, nextTrack, info } = props;
  const mediaMetadataSignatureRef = useRef("");
  useEffect(() => {
    if (!navigator.mediaSession) return;
    const { mediaSession } = navigator;
    const artist = info.artist.map((artist) => artist.name).join(", ");
    const artworkSrc = NeteaseImageSizeFilter(info.album.picUrl, ImageSize.md) || "";
    const signature = `${info.id}|${artist}|${artworkSrc}`;
    if (mediaMetadataSignatureRef.current !== signature) {
      mediaSession.metadata = new MediaMetadata({
        title: info.title,
        artist,
        album: info.album.name,
        artwork: [
          {
            src: artworkSrc,
            sizes: "500x500",
            type: "image/png"
          }
        ]
      });
      mediaMetadataSignatureRef.current = signature;
    }
    mediaSession.setActionHandler("play", play);
    mediaSession.setActionHandler("pause", play);
    mediaSession.setActionHandler("previoustrack", lastTrack);
    mediaSession.setActionHandler("nexttrack", nextTrack);
    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("previoustrack", null);
      mediaSession.setActionHandler("nexttrack", null);
      mediaSession.metadata = null;
      mediaMetadataSignatureRef.current = "";
    };
  }, [
    info.album.name,
    info.album.picUrl,
    info.artist,
    info.id,
    info.title,
    lastTrack,
    nextTrack,
    play
  ]);
}
