import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react";
import {
  Play,
  Disc3,
  Music2,
  ListPlus,
  ListMusic,
  RotateCcw,
  UserRound,
  ExternalLink,
  LoaderCircle,
  type LucideIcon
} from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { resolveAiraResourceAction } from "@mahiru/agent/browser";
import { NeteaseNetworkImage } from "@/common/netease/models";
import {
  NeteaseServicesAlbum,
  NeteaseServicesTrack,
  NeteaseServicesArtist,
  NeteaseServicesPlaylist
} from "@/common/netease/services";
import NeteaseImage from "@/common/components/display/image/netease-image";
import type { AiraResourceCard, AiraResourceAction } from "@mahiru/agent/browser";

import { getAiraResourceLabel, runAiraResourceAction } from "./resource-actions";

type PreviewTrack = {
  id: number;
  name: string;
  artist: string;
};

type ResourceCardData = {
  title: string;
  facts: string[];
  subtitle: string;
  description?: string;
  tracks: PreviewTrack[];
  cover: Nullable<NeteaseNetworkImage>;
};

const kindIcons: Record<AiraResourceCard["kind"], LucideIcon> = {
  track: Music2,
  album: Disc3,
  playlist: ListMusic,
  artist: UserRound
};

const actionMeta: Record<AiraResourceAction, { label: string; icon: LucideIcon }> = {
  open: { icon: ExternalLink, label: "查看" },
  play: { icon: Play, label: "播放" },
  queue: { icon: ListPlus, label: "加入队列" }
};

function previewTrack(track: {
  id: number;
  name: string;
  ar?: Array<{ name: string }>;
  detail?: { ar: Array<{ name: string }> };
}): PreviewTrack {
  const artists = track.detail?.ar ?? track.ar ?? [];
  return {
    id: track.id,
    name: track.name,
    artist: artists.map((artist) => artist.name).join(" / ")
  };
}

async function loadResourceCard(card: AiraResourceCard, signal: AbortSignal) {
  switch (card.kind) {
    case "track": {
      const track = await NeteaseServicesTrack.id(card.id, signal);
      if (!track) throw new Error("找不到这首歌曲");
      return {
        title: track.name,
        subtitle: track.ar.map((artist) => artist.name).join(" / "),
        description: track.translateAndAliaName(),
        cover: NeteaseNetworkImage.fromTrackCover(track)?.setSize(NeteaseImageSize.md) ?? null,
        facts: [track.al.name, RendererFormat.duration(track.dt)].filter(Boolean),
        tracks: []
      } satisfies ResourceCardData;
    }
    case "album": {
      const album = await NeteaseServicesAlbum.id(card.id, signal);
      return {
        title: album.content.name,
        subtitle: album.content.artists.map((artist) => artist.name).join(" / "),
        description: album.content.description,
        cover: NeteaseNetworkImage.fromAlbumCover(album)?.setSize(NeteaseImageSize.md) ?? null,
        facts: [
          `${album.content.size || album.tracks.length} 首`,
          album.content.publishTime ? RendererFormat.time(album.content.publishTime) : ""
        ].filter(Boolean),
        tracks: album.tracks.slice(0, 3).map(previewTrack)
      } satisfies ResourceCardData;
    }
    case "playlist": {
      const playlist = await NeteaseServicesPlaylist.preview(card.id, 3, signal);
      return {
        title: playlist.name,
        subtitle: playlist.creator.nickname,
        description: playlist.description,
        cover:
          NeteaseNetworkImage.fromPlaylistCover(playlist)?.setSize(NeteaseImageSize.md) ?? null,
        facts: [`${playlist.trackCount} 首`, `${playlist.playCountFormat()} 次播放`],
        tracks: playlist.tracks.slice(0, 3).map(previewTrack)
      } satisfies ResourceCardData;
    }
    case "artist": {
      const artist = await NeteaseServicesArtist.id(card.id, signal);
      const alias = [
        ...(artist.detail.artist.transNames ?? []),
        ...(artist.detail.artist.alias ?? [])
      ]
        .filter(Boolean)
        .join(" / ");
      return {
        title: artist.name,
        subtitle: alias || "音乐人",
        description: artist.detail.artist.briefDesc,
        cover: NeteaseNetworkImage.fromURL(artist.detail.artist.avatar)
          ?.setSize(NeteaseImageSize.md)
          .setAlt(artist.name),
        facts: [
          `${RendererFormat.count(artist.followInfos.fansCnt)} 粉丝`,
          `${artist.hotTracks.length} 首热门歌曲`
        ].filter(Boolean),
        tracks: artist.hotTracks.slice(0, 3).map(previewTrack)
      } satisfies ResourceCardData;
    }
  }
}

const CoverFallback: FC<{ icon: LucideIcon; children?: ReactNode }> = ({
  children,
  icon: Icon
}) => (
  <span className="agent-resource-cover-fallback">
    <Icon aria-hidden="true" />
    {children}
  </span>
);

const AgentResourceCard: FC<{ card: AiraResourceCard }> = ({ card }) => {
  const resourceKind = card.kind;
  const resourceID = card.id;
  const [retryKey, setRetryKey] = useState(0);
  const actionLock = useRef(false);
  const [activeAction, setActiveAction] = useState<Nullable<"preview" | AiraResourceAction>>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { message: string; status: "error" }
    | { status: "ready"; data: ResourceCardData }
  >({ status: "loading" });
  const featured = card.variant === "featured";
  const KindIcon = kindIcons[card.kind];
  const primaryAction = resolveAiraResourceAction(card);
  const actions = useMemo(() => {
    const supported: AiraResourceAction[] =
      card.kind === "track" ? ["play", "queue"] : ["open", "play", "queue"];
    const normalizedPrimary =
      card.kind === "track" && primaryAction === "open" ? "play" : primaryAction;
    return [normalizedPrimary, ...supported].filter(
      (action, index, list) => supported.includes(action) && list.indexOf(action) === index
    );
  }, [card.kind, primaryAction]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadResourceCard({ kind: resourceKind, id: resourceID }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "资源暂时不可用"
        });
      });
    return () => controller.abort();
  }, [resourceID, resourceKind, retryKey]);

  const runAction = useCallback(
    async (action: AiraResourceAction) => {
      if (actionLock.current) return;
      actionLock.current = true;
      setActiveAction(action);
      try {
        await runAiraResourceAction({ kind: resourceKind, id: resourceID }, action);
      } catch {
        // 错误提示由统一动作层展示。
      } finally {
        actionLock.current = false;
        setActiveAction(null);
      }
    },
    [resourceID, resourceKind]
  );

  const playPreview = useCallback(async (trackID: number) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setActiveAction("preview");
    try {
      await runAiraResourceAction({ kind: "track", id: trackID }, "play");
    } catch {
      // 错误提示由统一动作层展示。
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }, []);

  if (state.status === "loading") {
    return (
      <article
        className={cx("agent-resource-card agent-resource-card-loading", featured && "featured")}
        role="status"
        aria-busy="true"
        data-aira-resource-card={card.kind}
        aria-label={`正在载入${getAiraResourceLabel(card.kind)}`}>
        <span className="agent-resource-cover-skeleton" />
        <span className="agent-resource-loading-lines">
          <i />
          <i />
          <i />
        </span>
      </article>
    );
  }

  if (state.status === "error") {
    return (
      <article
        className="agent-resource-card agent-resource-card-error"
        role="alert"
        data-aira-resource-card={card.kind}
        aria-label={`${getAiraResourceLabel(card.kind)}载入失败`}>
        <CoverFallback icon={KindIcon} />
        <span className="min-w-0 flex-1">
          <strong>{state.message}</strong>
          <small>资源可能已失效，也可能是网络暂时不可用。</small>
        </span>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
          <RotateCcw aria-hidden="true" />
          重试
        </button>
      </article>
    );
  }

  const { data } = state;
  return (
    <article
      className={cx("agent-resource-card", featured && "featured")}
      data-aira-resource-card={card.kind}
      aria-label={`${getAiraResourceLabel(card.kind)}：${data.title}`}>
      <button
        className="agent-resource-cover"
        type="button"
        disabled={activeAction !== null}
        aria-label={`${card.kind === "track" ? "播放" : "查看"}${data.title}`}
        onClick={() => void runAction(card.kind === "track" ? "play" : "open")}>
        {data.cover ? (
          <NeteaseImage
            shadow="none"
            cacheLazy={false}
            image={data.cover}
            fallback={<CoverFallback icon={KindIcon} />}
            cache
          />
        ) : (
          <CoverFallback icon={KindIcon} />
        )}
        {card.kind === "track" && (
          <span className="agent-resource-cover-play">
            <Play aria-hidden="true" />
          </span>
        )}
      </button>

      <div className="agent-resource-body">
        <div className="agent-resource-overline">
          <KindIcon aria-hidden="true" />
          <span>{getAiraResourceLabel(card.kind)}</span>
          <i />
          {data.facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
        <button
          className="agent-resource-title"
          type="button"
          disabled={activeAction !== null}
          onClick={() => void runAction(card.kind === "track" ? "play" : "open")}>
          {data.title}
        </button>
        <p className="agent-resource-subtitle">{data.subtitle}</p>
        {data.description && <p className="agent-resource-description">{data.description}</p>}

        {featured && data.tracks.length > 0 && (
          <ol className="agent-resource-preview" aria-label="曲目预览">
            {data.tracks.map((track, index) => (
              <li key={track.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => void playPreview(track.id)}>
                  <strong>{track.name}</strong>
                  <small>{track.artist}</small>
                </button>
                <Play aria-hidden="true" />
              </li>
            ))}
          </ol>
        )}

        <div className="agent-resource-actions">
          {actions.map((action, index) => {
            const { label, icon: ActionIcon } = actionMeta[action];
            const loading = activeAction === action;
            return (
              <button
                key={action}
                className={cx(index === 0 && "primary")}
                type="button"
                aria-busy={loading}
                disabled={activeAction !== null}
                aria-label={`${label}${data.title}`}
                onClick={() => void runAction(action)}>
                {loading ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ActionIcon aria-hidden="true" />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
};

export default memo(AgentResourceCard);
