import { cx } from "@emotion/css";
import { memo, type FC, useMemo, Fragment, useEffect, useCallback } from "react";
import {
  X,
  Play,
  Disc3,
  Heart,
  Pause,
  Music2,
  Shuffle,
  SkipBack,
  SkipForward,
  ArrowRightLeft,
  type LucideIcon
} from "lucide-react";
import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { useHeart } from "@/common/hooks/use-heart";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { repeatModeControls } from "@/common/constants/repeat";
import { useWindowTitle } from "@/common/hooks/use-window-title";
import { useWindowVisible } from "@/common/hooks/use-window-visible";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useShortcutForwarder } from "@/common/hooks/use-shortcut-forwarder";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { NeteaseURL, NeteaseArtist, NeteaseNetworkImage } from "@/common/netease/models";
import Drag from "@/common/components/layout/drag/drag";
import Marquee from "@/common/components/display/marquee";
import NoDrag from "@/common/components/layout/drag/no-drag";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import type { ReactNode } from "react";

import MiniProgress from "./mini-progress";

const marqueeOpts = {
  speed: 10,
  pingPong: true,
  pauseOnHover: true,
  gapDuration: 2000
};

const MiniPlayerPage: FC = () => {
  // 迷你播放器聚焦时，命中的快捷键转发给主窗口执行
  useShortcutForwarder();
  const visible = useWindowVisible();
  const themeBus = useThemeInjectFromBus();
  const lyricWindow = useListenable(RendererWindow.lyric);
  const { data: meta } = useListenable(RendererIPCMessageBus.trackMeta, !visible);
  const { heartManager } = useUserTrackManager();
  const { checkLiked, likedChange } = useHeart(heartManager);

  const track = meta?.track?.detail;
  const album = track?.al;
  const isPlaying = meta?.status === "playing";
  const isLiked = checkLiked(track);
  const repeat = meta?.repeat ?? "off";
  const repeatControl = repeatModeControls[repeat];
  const bg = useMemo(
    () => NeteaseURL.setImageSize(album?.picUrl, NeteaseImageSize.sm),
    [album?.picUrl]
  );
  const cover = useMemo(() => {
    return NeteaseNetworkImage.fromTrackCover(track)?.setSize(NeteaseImageSize.sm);
  }, [track]);

  const close = useCallback(() => {
    RendererWindow.current.hide();
    RendererWindow.main.unminimize();
    RendererWindow.main.show();
    RendererWindow.main.focus();
  }, []);

  const toggleLyric = useCallback(() => {
    if (lyricWindow.isShow) {
      lyricWindow.close();
    } else if (lyricWindow.opened) {
      lyricWindow.show();
    } else {
      void lyricWindow
        .reactReadyAwait()
        .catch((error) => Log.error("MiniPlayer", "打开桌面歌词失败", error));
    }
  }, [lyricWindow]);

  useEffect(() => {
    if (!visible) return;
    RendererIPCMessageBus.updater.deliver("track-meta");
    RendererIPCMessageBus.updater.deliver("track-progress");
  }, [visible]);

  useEffect(() => {
    return RendererWindow.main.addEventListener("show", () => {
      RendererWindow.current.hide();
    });
  }, []);

  useWindowTitle(track);

  return (
    <Drag className={cx("relative overflow-hidden", !bg && "text-black")}>
      <section className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          className="absolute inset-0"
          src={bg}
          blur={10}
          opacity={1}
          saturate={2}
          brightness={0.6}
          themeColors={themeBus.data?.theme.themeColors}
        />
      </section>
      <section className="relative z-10 grid h-screen w-screen grid-rows-[44px_12px_24px] content-center gap-1 px-2.5">
        <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
          <NoDrag className="relative size-11 rounded-md border overflow-hidden border-white/30 bg-primary/30">
            {cover ? (
              <NeteaseImage
                className="
                  size-full hover:opacity-50 cursor-pointer
                  ease-in-out duration-300 transition-opacity
                "
                image={cover}
                shadow="none"
                cacheLazy={false}
                imageClassName="object-cover"
                onClick={async () => {
                  const image = cover.toNetworkImage().setSize(NeteaseImageSize.raw);
                  await RendererWindow.image.reactReadyAwait();
                  RendererIPCMessageBus.preview.deliver({ url: image.src, alt: image.alt });
                }}
                cache
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Music2 className="size-5" />
              </div>
            )}
            <span className="absolute right-0.5 top-0.5 flex size-2.5 items-center justify-center rounded-full bg-primary">
              <Disc3 className={cx("size-2 text-primary-text", isPlaying && "animate-spin")} />
            </span>
          </NoDrag>
          <div className="min-w-0">
            <Marquee
              className="text-[12px] font-semibold leading-4"
              options={marqueeOpts}
              text={meta?.track?.name || "暂无播放"}
            />
            <Marquee className="text-[10px] font-medium leading-4 opacity-80" options={marqueeOpts}>
              <span>
                {track?.ar.map((artist, index) => (
                  <Fragment key={NeteaseArtist.computedKey(artist, index)}>
                    <NoDrag
                      className="inline cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all"
                      title={artist.name}
                      onClick={async () => {
                        await RendererWindow.display.reactReadyAwait();
                        RendererIPCMessageBus.display.deliver({ type: "artist", id: artist.id });
                      }}>
                      {artist.name}
                    </NoDrag>
                    {index !== track.ar.length - 1 && <span> / </span>}
                  </Fragment>
                ))}
              </span>
              {album && (
                <>
                  <span> - </span>
                  <NoDrag
                    className="inline cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all"
                    title={album.name}
                    onClick={async () => {
                      await RendererWindow.display.reactReadyAwait();
                      RendererIPCMessageBus.display.deliver({ type: "album", id: album.id });
                    }}>
                    {album.name}
                  </NoDrag>
                </>
              )}
            </Marquee>
          </div>
          <NoDrag className="flex items-center gap-0.5 self-start">
            <ControlButton
              label="定位应用窗口"
              onClick={() =>
                RendererIPC.NormalChannel.send("event_miniplayer_focus_window", undefined)
              }>
              <img className="size-4" alt="" draggable={false} src="/images/logo.svg" />
            </ControlButton>
            <ControlButton icon={X} label="隐藏迷你播放器" onClick={close} />
          </NoDrag>
        </div>
        <MiniProgress
          track={track}
          visible={visible}
          playing={isPlaying}
          color={bg ? "#ffffff" : "#171717"}
        />
        <NoDrag className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <ControlButton
              icon={SkipBack}
              disabled={meta?.mode === "fm"}
              label={meta?.mode === "fm" ? "私人 FM 不支持上一首" : "上一首"}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("previous")}
              filled
            />
            <ControlButton
              icon={isPlaying ? Pause : Play}
              label={isPlaying ? "暂停" : "播放"}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("play-toggle")}
              filled
              primary
            />
            <ControlButton
              label="下一首"
              icon={SkipForward}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("next")}
              filled
            />
          </div>
          <div className="flex items-center gap-1">
            <ControlButton
              pressed={meta?.shuffle ?? false}
              disabled={!meta || meta.mode !== "normal"}
              icon={meta?.shuffle ? Shuffle : ArrowRightLeft}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("shuffle-toggle")}
              label={
                !meta || meta.mode !== "normal"
                  ? "当前播放模式不可切换随机"
                  : meta.shuffle
                    ? "关闭随机播放"
                    : "开启随机播放"
              }
            />
            <ControlButton
              disabled={!meta}
              icon={repeatControl.icon}
              pressed={repeat !== "off"}
              label={repeatControl.label}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("repeat-cycle")}
            />
            <ControlButton
              icon={Heart}
              filled={isLiked}
              pressed={isLiked}
              label={isLiked ? "取消喜欢" : "喜欢这首歌"}
              disabled={!track || !heartManager.TrackLikedSource}
              onClick={() => likedChange(track)}
            />
            <ControlButton
              pressed={lyricWindow.isShow}
              label={lyricWindow.isShow ? "关闭桌面歌词" : "打开桌面歌词"}
              onClick={toggleLyric}>
              <span className="text-xs font-semibold">词</span>
            </ControlButton>
          </div>
        </NoDrag>
      </section>
    </Drag>
  );
};

export default memo(MiniPlayerPage);

const ControlButton = ({
  onClick,
  label,
  filled,
  pressed,
  primary,
  children,
  disabled,
  icon: Icon
}: {
  label: string;
  filled?: boolean;
  icon?: LucideIcon;
  pressed?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick: NormalFunc;
  children?: ReactNode;
}) => (
  <button
    className={cx(
      `flex size-6 shrink-0 items-center justify-center rounded-full outline-none
      transition-all duration-200 ease-in-out active:scale-90
      enabled:hover:bg-(--text-color-on-main)/50 enabled:hover:text-primary
      focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40`,
      primary && "bg-(--text-color-on-main)/20",
      pressed && "bg-(--text-color-on-main)/25"
    )}
    title={label}
    type="button"
    aria-label={label}
    disabled={disabled}
    aria-pressed={pressed}
    onClick={onClick}
    onKeyDown={(event) => {
      if (
        event.key === " " &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.stopPropagation();
      }
    }}>
    {Icon ? (
      <Icon className="size-3.5" aria-hidden="true" fill={filled ? "currentColor" : "none"} />
    ) : (
      children
    )}
  </button>
);
