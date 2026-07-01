import { memo, useRef, type FC, useMemo, useEffect, useCallback, useLayoutEffect } from "react";
import {
  Copy,
  Play,
  Pause,
  LogOut,
  MicVocal,
  SkipBack,
  DiscAlbum,
  SkipForward,
  ExternalLink,
  MessageSquare,
  type LucideIcon
} from "lucide-react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AppToast from "@/common/components/display/toast";
import AcrylicBackground from "@/common/components/display/acrylic-background";

import TrayItem from "./tray-item";
import TrayPlayer from "./tray-player";
import TrayDivider from "./tray-divider";

type TrayAction = {
  text: string;
  active?: boolean;
  danger?: boolean;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: NormalFunc;
};

const TrayPage: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentSizeRef = useRef<Nullable<{ width: number; height: number }>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const progressBus = useListenable(RendererIPCMessageBus.progress);
  const currentWindow = useListenable(RendererWindow.current);
  const themeBus = useThemeInjectFromBus();
  const trackRecord = trackMetaBus.data?.track;
  const track = trackRecord?.detail;
  const isPlaying = trackMetaBus.data?.status === "playing";
  const artistName = track?.ar.map((item) => item.name).join(" / ");
  const firstArtistID = track?.ar.find((item) => item.id > 0)?.id;
  const albumID = track?.al.id && track.al.id > 0 ? track.al.id : undefined;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const updateWindowBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const width = Math.ceil(container.offsetWidth || window.innerWidth);
        const height = Math.ceil(container.offsetHeight || window.innerHeight);
        const currentSize = contentSizeRef.current;
        if (currentSize?.width === width && currentSize.height === height) return;

        contentSizeRef.current = { height, width };
        const deltaX = window.innerWidth - width;
        const deltaY = window.innerHeight - height;

        currentWindow.resize({ width, height });
        currentWindow.move({
          x: window.screenX + deltaX,
          y: window.screenY + deltaY
        });
      });
    };

    const observer = new ResizeObserver(updateWindowBounds);
    observer.observe(container);
    updateWindowBounds();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [currentWindow]);

  useEffect(() => {
    document.title = track?.name && artistName ? `${track.name} - ${artistName}` : "AiraMusic";
  }, [artistName, track?.name]);

  const copy = useCallback(async (text: Optional<string>, label: string) => {
    if (!text) return;
    try {
      await window.navigator.clipboard.writeText(text);
      AppToast.show({ type: "success", text: `${label}已复制` });
    } catch {
      AppToast.show({ type: "error", text: `${label}复制失败` });
    }
  }, []);

  const openDisplay = useCallback(async (data: { id: number; type: "album" | "artist" }) => {
    await RendererWindow.display.reactReadyAwait();
    RendererIPCMessageBus.display.deliver(data);
    RendererWindow.current.hide();
  }, []);

  const openComment = useCallback(async () => {
    const id = trackRecord?.id;
    if (!id) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({
      id,
      type: "track"
    });
    RendererWindow.current.hide();
  }, [trackRecord?.id]);

  const showMainWindow = useCallback(() => {
    RendererWindow.main.show();
    RendererWindow.main.focus();
    RendererWindow.current.hide();
  }, []);

  const playbackActions = useMemo<TrayAction[]>(
    () => [
      {
        icon: isPlaying ? Pause : Play,
        text: isPlaying ? "暂停" : "播放",
        active: true,
        onClick: () => RendererIPCMessageBus.playerAction.deliver(isPlaying ? "pause" : "play")
      },
      {
        icon: SkipBack,
        text: "上一首",
        onClick: () => RendererIPCMessageBus.playerAction.deliver("previous")
      },
      {
        icon: SkipForward,
        text: "下一首",
        onClick: () => RendererIPCMessageBus.playerAction.deliver("next")
      }
    ],
    [isPlaying]
  );

  const detailActions = useMemo<TrayAction[]>(
    () => [
      {
        icon: MicVocal,
        text: "查看歌手",
        disabled: !firstArtistID,
        onClick: () => firstArtistID && void openDisplay({ type: "artist", id: firstArtistID })
      },
      {
        icon: DiscAlbum,
        text: "查看专辑",
        disabled: !albumID,
        onClick: () => albumID && void openDisplay({ type: "album", id: albumID })
      },
      {
        icon: MessageSquare,
        text: "查看评论",
        disabled: !trackRecord?.id,
        onClick: () => void openComment()
      }
    ],
    [albumID, firstArtistID, openComment, openDisplay, trackRecord?.id]
  );

  const copyActions = useMemo<TrayAction[]>(
    () => [
      {
        icon: Copy,
        text: "复制歌名",
        disabled: !track?.name,
        onClick: () => void copy(track?.name, "歌名")
      },
      {
        icon: Copy,
        text: "复制歌手名",
        disabled: !artistName,
        onClick: () => void copy(artistName, "歌手名")
      },
      {
        icon: Copy,
        text: "复制专辑名",
        disabled: !track?.al.name,
        onClick: () => void copy(track?.al.name, "专辑名")
      }
    ],
    [artistName, copy, track?.al.name, track?.name]
  );

  const systemActions = useMemo<TrayAction[]>(
    () => [
      {
        icon: ExternalLink,
        text: "打开主窗口",
        onClick: showMainWindow
      },
      {
        icon: LogOut,
        text: "退出",
        danger: true,
        onClick: () => RendererIPCMessageBus.playerAction.deliver("exit")
      }
    ],
    [showMainWindow]
  );

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="
          max-w-50 w-max rounded-xl border border-black/8
          backdrop-saturate-150 backdrop-blur-xl p-2 relative bg-white/80
        ">
        <div className="fixed inset-0 z-[-1]">
          <AcrylicBackground
            className="rounded-xl overflow-hidden"
            blur={20}
            saturate={3}
            opacity={0.8}
            brightness={0.3}
            src={themeBus.data?.backgroundCover}
            themeColors={themeBus.data?.theme.themeColors}
          />
        </div>
        <TrayPlayer
          track={track}
          status={trackMetaBus.data?.status}
          duration={progressBus.data?.duration}
          currentTime={progressBus.data?.currentTime}
        />
        <TrayDivider />
        <TrayGroup actions={playbackActions} />
        <TrayDivider />
        <TrayGroup actions={detailActions} />
        <TrayDivider />
        <TrayGroup actions={copyActions} />
        <TrayDivider />
        <TrayGroup actions={systemActions} />
      </div>
      <AppToast.Provider className="top-2 z-50" />
    </div>
  );
};

const TrayGroup: FC<{ actions: TrayAction[] }> = memo(({ actions }) => {
  return (
    <div className="grid gap-0.5">
      {actions.map((item) => (
        <TrayItem key={item.text} {...item} />
      ))}
    </div>
  );
});

export default memo(TrayPage);
