import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { resolveAiraResourceAction } from "@mahiru/agent/browser";
import {
  NeteaseServicesAlbum,
  NeteaseServicesArtist,
  NeteaseServicesPlaylist
} from "@/common/netease/services";
import AppToast from "@/common/components/display/toast";
import type { MessageData } from "@mahiru/ipc/types";
import type { AiraResourceAction, AiraResourceReference } from "@mahiru/agent/browser";

const PlaylistActionTimeoutMs = 15_000;

const resourceLabels = {
  album: "专辑",
  artist: "歌手",
  playlist: "歌单",
  track: "歌曲"
} as const;

function ensureResourceID(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("资源 ID 无效");
}

function dispatchPlaylistAction(action: MessageData<"bus_dispatch_playlist_action">) {
  const requestID = window.crypto.randomUUID();
  const { reject, promise, resolve } = Promise.withResolvers<void>();
  let settled = false;

  const finish = (error?: Error) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    unsubscribe();
    if (error) reject(error);
    else resolve();
  };
  const unsubscribe = RendererIPC.MessageChannel.listen(
    "bus_deliver_playlist_action_result",
    "main",
    (result) => {
      if (result.requestID !== requestID) return;
      finish(result.ok ? undefined : new Error(result.error || "播放操作失败"));
    }
  );
  const timer = window.setTimeout(
    () => finish(new Error("播放器响应超时，请确认主窗口仍在运行")),
    PlaylistActionTimeoutMs
  );

  try {
    RendererIPCMessageBus.playlistAction.deliver({ ...action, requestID });
  } catch (error) {
    finish(error instanceof Error ? error : new Error("无法连接播放器"));
  }

  return promise;
}

async function openResource(resource: AiraResourceReference) {
  if (resource.kind === "track") {
    await dispatchPlaylistAction({ type: "playTrack", trackID: resource.id });
    return;
  }

  await RendererWindow.display.reactReadyAwait();
  if (resource.kind === "playlist") {
    RendererIPCMessageBus.display.deliver({
      id: resource.id,
      source: "normal",
      type: "playlist"
    });
    return;
  }

  RendererIPCMessageBus.display.deliver({ type: resource.kind, id: resource.id });
}

async function getResourceTracks(resource: AiraResourceReference) {
  switch (resource.kind) {
    case "track":
      return {
        allIDs: [resource.id],
        sourceID: 0,
        sourceType: "other" as const
      };
    case "album": {
      const album = await NeteaseServicesAlbum.id(resource.id);
      return {
        allIDs: album.tracks.map((track) => track.id),
        sourceID: resource.id,
        sourceType: "album" as const
      };
    }
    case "playlist": {
      const playlist = await NeteaseServicesPlaylist.id(resource.id);
      return {
        allIDs: playlist.trackIds,
        sourceID: resource.id,
        sourceType: "playlist" as const
      };
    }
    case "artist": {
      const artist = await NeteaseServicesArtist.id(resource.id);
      return {
        allIDs: artist.hotTracks.map((track) => track.id),
        sourceID: resource.id,
        sourceType: "other" as const
      };
    }
  }
}

export async function runAiraResourceAction(
  resource: AiraResourceReference,
  requestedAction?: AiraResourceAction
) {
  ensureResourceID(resource.id);
  const action = requestedAction ?? resolveAiraResourceAction(resource);

  try {
    if (action === "open") {
      await openResource(resource);
      return;
    }

    if (resource.kind === "track") {
      await dispatchPlaylistAction(
        action === "play"
          ? { type: "playTrack", trackID: resource.id }
          : {
              type: "addToPlaylistNext",
              trackID: resource.id,
              sourceID: 0,
              sourceType: "other"
            }
      );
      if (action === "queue") {
        AppToast.show({ type: "success", text: "已加入下一首" });
      }
      return;
    }

    const tracks = await getResourceTracks(resource);
    const firstID = tracks.allIDs[0];
    if (!firstID) throw new Error(`${resourceLabels[resource.kind]}中没有可用歌曲`);

    if (action === "play") {
      await dispatchPlaylistAction({
        ...tracks,
        type: "replacePlaylistAndPlay",
        trackID: firstID,
        trackIdx: 0
      });
      return;
    }

    await dispatchPlaylistAction({
      ...tracks,
      type: "addListToPlaylistEnd"
    });
    AppToast.show({ type: "success", text: `已将${resourceLabels[resource.kind]}加入队列` });
  } catch (error) {
    AppToast.show({
      type: "error",
      text: error instanceof Error ? error.message : "资源操作失败"
    });
    throw error;
  }
}

export function getAiraResourceLabel(kind: AiraResourceReference["kind"]) {
  return resourceLabels[kind];
}
