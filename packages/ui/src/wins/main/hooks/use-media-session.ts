import { useRef, useEffect, useLayoutEffect } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseURL } from "@/common/netease/models";
import RendererPlayerHandle from "@/wins/main/lib/handle";

export function useMediaSession(props: {
  play: NormalFunc<any>;
  pause: NormalFunc<any>;
  lastTrack: NormalFunc<any>;
  nextTrack: NormalFunc<any>;
  seekForward: NormalFunc<[gap: number]>;
  seekTo: NormalFunc<[position: number]>;
  seekBackward: NormalFunc<[gap: number]>;
  changeTime: NormalFunc<[position: number]>;
}) {
  const getProps = useRef(props);
  const mediaMetadataSignatureRef = useRef("");
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track;
  getProps.current = props;

  useLayoutEffect(() => {
    if (!window?.navigator?.mediaSession) return;
    const { mediaSession } = navigator;

    // 统一通过 getProps.current 取最新回调，避免 handler 永远闭包住首次渲染的 props。
    const handlers: Record<MediaSessionAction, null | MediaSessionActionHandler> = {
      play: () => getProps.current.play(),
      pause: () => getProps.current.pause(),
      previoustrack: () => getProps.current.lastTrack(),
      nexttrack: () => getProps.current.nextTrack(),
      stop: () => {
        getProps.current.pause();
        getProps.current.seekTo(0);
      },
      seekforward: () => {
        getProps.current.seekForward(10);
      },
      seekbackward: () => {
        getProps.current.seekBackward(10);
      },
      seekto: (details) => {
        // seekTime 为 0（跳到开头）也是合法值，不能用 truthy 判断
        if (details.seekTime == null) return;
        if (details.fastSeek) {
          getProps.current.seekTo(details.seekTime);
        } else {
          getProps.current.changeTime(details.seekTime);
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
            type: "image/jpeg"
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
      // metadata 未加载（NaN）或流媒体（Infinity）时 setPositionState 会抛 TypeError；
      // position 超过 duration 同样会抛
      const duration = audio.duration;
      if (!Number.isFinite(duration)) return;
      mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(Math.max(audio.currentTime || 0, 0), duration)
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
