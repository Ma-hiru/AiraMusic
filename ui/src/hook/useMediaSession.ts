import { useEffect, useRef } from "react";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { TrackStatus } from "@mahiru/ui/hook/useSongNew";

export function useMediaSession(props: {
  play: NormalFunc<any>;
  lastTrack: NormalFunc<any>;
  nextTrack: NormalFunc<any>;
  trackStatus: Nullable<TrackStatus>;
}) {
  const { play, lastTrack, nextTrack, trackStatus } = props;
  const mediaMetadataSignatureRef = useRef("");
  useEffect(() => {
    if (!navigator.mediaSession) return;
    const { mediaSession } = navigator;
    const artist = trackStatus?.track.ar.map((artist) => artist.name).join(", ");
    const artworkSrc = NeteaseImageSizeFilter(trackStatus?.track.al.picUrl, ImageSize.md) || "";
    const signature = `${trackStatus?.track.id}|${artist}|${artworkSrc}`;
    if (mediaMetadataSignatureRef.current !== signature) {
      mediaSession.metadata = new MediaMetadata({
        title: trackStatus?.track.title,
        artist,
        album: trackStatus?.track.al.name,
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
