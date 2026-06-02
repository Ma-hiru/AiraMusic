import { type FC, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Copy,
  DiscAlbum,
  ExternalLink,
  LogOut,
  MessageSquare,
  MicVocal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  type LucideIcon
} from "lucide-react";
import AppToast from "@/common/components/toast";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { RendererEventBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";

import TrayDivider from "./tray-divider";
import TrayItem from "./tray-item";
import TrayPlayer from "./tray-player";

type TrayAction = {
  icon: LucideIcon;
  text: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: NormalFunc;
};

const TrayPage: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerBus = useListenable(RendererEventBus.player);
  const progressBus = useListenable(RendererEventBus.progress);
  const mainWindow = useListenable(RendererWindow.main);
  const currentWindow = useListenable(RendererWindow.current);
  const trackRecord = playerBus.data?.track;
  const track = trackRecord?.detail;
  const isPlaying = playerBus.data?.status === "playing";
  const artistName = track?.ar.map((item) => item.name).join(" / ");
  const firstArtistID = track?.ar.find((item) => item.id > 0)?.id;
  const albumID = track?.al.id && track.al.id > 0 ? track.al.id : undefined;

  useThemeInjectFromBus();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const updateWindowBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const width = Math.ceil(container.offsetWidth || window.innerWidth);
        const height = Math.ceil(container.offsetHeight || window.innerHeight);
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

  const hideTray = useCallback(() => currentWindow.hide(), [currentWindow]);

  const copy = useCallback(async (text: Optional<string>, label: string) => {
    if (!text) return;
    try {
      await window.navigator.clipboard.writeText(text);
      AppToast.show({ type: "success", text: `${label}已复制` });
    } catch {
      AppToast.show({ type: "error", text: `${label}复制失败` });
    }
  }, []);

  const openDisplay = useCallback(
    async (data: { type: "album" | "artist"; id: number }) => {
      await RendererWindow.display.reactReadyAwait();
      RendererEventBus.display.send(data);
      hideTray();
    },
    [hideTray]
  );

  const openComment = useCallback(async () => {
    const id = trackRecord?.id;
    if (!id) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererEventBus.comment.send({
      id,
      type: "track"
    });
    hideTray();
  }, [hideTray, trackRecord?.id]);

  const showMainWindow = useCallback(() => {
    mainWindow.show();
    mainWindow.focus();
    hideTray();
  }, [hideTray, mainWindow]);

  const playbackActions = useMemo<TrayAction[]>(
    () => [
      {
        icon: isPlaying ? Pause : Play,
        text: isPlaying ? "暂停" : "播放",
        active: true,
        onClick: () => RendererEventBus.playerAction.send(isPlaying ? "pause" : "play")
      },
      {
        icon: SkipBack,
        text: "上一首",
        onClick: () => RendererEventBus.playerAction.send("previous")
      },
      {
        icon: SkipForward,
        text: "下一首",
        onClick: () => RendererEventBus.playerAction.send("next")
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
        onClick: () => RendererEventBus.playerAction.send("exit")
      }
    ],
    [showMainWindow]
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent text-black">
      <div
        ref={containerRef}
        className="
          w-[13.5rem] rounded-xl border border-black/8 bg-white/96 p-2
          shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl
        ">
        <TrayPlayer
          track={track}
          status={playerBus.data?.status}
          currentTime={progressBus.data?.currentTime}
          duration={progressBus.data?.duration}
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
