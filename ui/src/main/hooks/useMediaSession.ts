import { useEffect, useLayoutEffect, useRef } from "react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { NeteaseURL } from "@mahiru/ui/public/models/netease";
import AppInstance from "@mahiru/ui/main/entry/instance";

export function useMediaSession(props: {
  play: NormalFunc<any>;
  pause: NormalFunc<any>;
  lastTrack: NormalFunc<any>;
  nextTrack: NormalFunc<any>;
  mute: NormalFunc<any>;
  unmute: NormalFunc<any>;
  seekForward: NormalFunc<[gap: number]>;
  seekBackward: NormalFunc<[gap: number]>;
  seekTo: NormalFunc<[position: number]>;
  changeTime: NormalFunc<[position: number]>;
}) {
  const getProps = useRef(props);
  const mediaMetadataSignatureRef = useRef("");
  const player = AppInstance.usePlayer();
  const track = player.current.track;
  getProps.current = props;

  useLayoutEffect(() => {
    if (!window?.navigator?.mediaSession) return;
    const { mediaSession } = navigator;
    const { play, pause, lastTrack, nextTrack, seekTo, seekBackward, seekForward, changeTime } =
      getProps.current;

    const handlers: Record<MediaSessionAction, MediaSessionActionHandler | null> = {
      play,
      pause,
      previoustrack: lastTrack,
      nexttrack: nextTrack,
      stop: () => {
        pause();
        seekTo(0);
      },
      seekforward: () => {
        seekForward(10);
      },
      seekbackward: () => {
        seekBackward(10);
      },
      seekto: (details) => {
        if (details.seekTime) {
          if (details.fastSeek) {
            seekTo(details.seekTime);
          } else {
            changeTime(details.seekTime);
          }
        }
      },
      skipad: null
    };

    for (const [action, handler] of Object.entries(handlers)) {
      mediaSession.setActionHandler(action as MediaSessionAction, handler);
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        mediaSession.setActionHandler(action as MediaSessionAction, null);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!window?.navigator?.mediaSession) return;
    if (!track) return;
    const { mediaSession } = navigator;
    const artist = track.detail.ar.map((artist) => artist.name).join("&");
    const artworkSrc = NeteaseURL.setImageSize(track?.detail.al.picUrl, NeteaseImageSize.lg) || "";
    const signature = `${track?.detail.id}|${artist}|${artworkSrc}`;
    if (mediaMetadataSignatureRef.current !== signature) {
      mediaSession.metadata = new MediaMetadata({
        title: track.detail.name,
        artist,
        album: track.detail.al.name,
        artwork: [
          {
            src: artworkSrc,
            sizes: "500x500",
            type: "image/jpg"
          }
        ]
      });
      mediaSession.setPositionState(undefined);
      mediaMetadataSignatureRef.current = signature;
    }
  }, [track]);

  useEffect(() => {
    if (!window?.navigator?.mediaSession) return;
    const { mediaSession } = navigator;
    const audio = player.audio.instance;

    const updatePosition = () => {
      mediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate || 1,
        position: audio.currentTime || 0
      });
    };

    const updatePlaybackState = () => {
      mediaSession.playbackState = audio.paused ? "paused" : "playing";
    };

    audio.addEventListener("play", updatePlaybackState, { passive: true });
    audio.addEventListener("pause", updatePlaybackState, { passive: true });
    audio.addEventListener("ended", updatePlaybackState, { passive: true });
    audio.addEventListener("timeupdate", updatePosition, { passive: true });
    return () => {
      audio.removeEventListener("play", updatePlaybackState);
      audio.removeEventListener("pause", updatePlaybackState);
      audio.removeEventListener("ended", updatePlaybackState);
      audio.removeEventListener("timeupdate", updatePosition);
    };
  }, [player.audio.instance]);

  useEffect(() => {
    if (!window?.navigator?.mediaSession) return;
    const { mediaSession } = navigator;
    return () => {
      mediaSession.metadata = null;
      mediaSession.setPositionState(undefined);
    };
  }, []);
}
