import axios from "axios";
import Dexie, { Table } from "dexie";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { EqError } from "@mahiru/ui/utils/err";
import {
  NeteaseAlbumDetailResponse,
  NeteaseLyricResponse,
  NeteaseTrack,
  NeteaseTrackPrivilege
} from "@mahiru/ui/types/netease-api";
import { Log } from "@mahiru/ui/utils/log";

export interface TrackSourceRow {
  id: number;
  source: ArrayBuffer;
  bitRate: number;
  from: string;
  name: string;
  artist: string;
  createTime: number;
}

export interface TrackDetailRow {
  id: number;
  detail: NeteaseTrack;
  privileges: NeteaseTrackPrivilege;
  updateTime: number;
}

export interface LyricRow {
  id: number;
  lyrics: NeteaseLyricResponse;
  updateTime: number;
}

export interface AlbumRow {
  id: number;
  album: NeteaseAlbumDetailResponse;
  updateTime: number;
}

class AppDB extends Dexie {
  trackSources!: Table<TrackSourceRow, number>;
  trackDetail!: Table<TrackDetailRow, number>;
  lyric!: Table<LyricRow, number>;
  album!: Table<AlbumRow, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      trackSources: "&id, createTime",
      trackDetail: "&id, updateTime",
      lyric: "&id, updateTime",
      album: "&id, updateTime"
    });
  }
}

const db = new AppDB("simple-cloud-music");

let tracksCacheBytes = 0;
async function deleteExcessCache() {
  const { settings } = usePersistZustandStore.getState();
  if (settings.cacheLimit === false || tracksCacheBytes < settings.cacheLimit * Math.pow(1024, 2)) {
    return;
  }
  try {
    const delCache = await db.trackSources.orderBy("createTime").first();
    if (delCache) {
      await db.trackSources.delete(delCache.id);
      tracksCacheBytes -= delCache.source.byteLength;
      Log.trace(
        "ui/db:deleteExcessCache",
        `Deleted cached track 👉 ${delCache.name} by ${delCache.artist}`
      );
      await deleteExcessCache();
    }
  } catch (err) {
    Log.error(
      new EqError({
        message: "Error deleting excess cache:",
        raw: err,
        label: "ui/db:deleteExcessCache"
      })
    );
  }
}

// 缓存歌曲数据到 IndexedDB
export function cacheTrackSource(
  trackInfo: NeteaseTrack,
  url: string,
  bitRate: number,
  from = "netease"
) {
  const name = trackInfo.name;
  const artist = trackInfo?.ar?.[0]?.name || "Unknown";
  const cover = trackInfo.al.picUrl.startsWith("https")
    ? trackInfo.al.picUrl
    : "https" + trackInfo.al.picUrl.slice(4);
  // 预加载专辑封面不同尺寸，提升后续使用时的加载速度
  axios.get(`${cover}?param=512y512`).catch();
  axios.get(`${cover}?param=224y224`).catch();
  axios.get(`${cover}?param=1024y1024`).catch();
  return axios
    .get(url, {
      responseType: "arraybuffer"
    })
    .then((response) => {
      db.trackSources.put({
        id: trackInfo.id,
        source: response.data,
        bitRate,
        from,
        name,
        artist,
        createTime: new Date().getTime()
      });
      console.debug(`cached track 👉 ${name} by ${artist}`);
      tracksCacheBytes += response.data.byteLength;
      deleteExcessCache().then();
      return { trackID: trackInfo.id, source: response.data as ArrayBuffer, bitRate };
    });
}

export function getTrackSourceFromCache(id: number) {
  return db.trackSources.get(Number(id)).then((track) => {
    if (!track) return null;
    Log.trace("ui/db:getTrackSource", `Loaded cached track 👉 ${track.name} by ${track.artist}`);
    return track;
  });
}

export function cacheTrackDetail(track: NeteaseTrack, privileges: NeteaseTrackPrivilege) {
  db.trackDetail.put({
    id: track.id,
    detail: track,
    privileges,
    updateTime: new Date().getTime()
  });
}

export function getTrackDetailFromCache(ids: string[]) {
  return db.trackDetail
    .filter((track) => ids.includes(String(track.id)))
    .toArray()
    .then((tracks) => {
      const result = ids.reduce(
        (acc, id) => {
          const one = tracks.find((track) => String(track.id) === id);
          acc.songs.push(one?.detail ?? null);
          acc.privileges.push(one?.privileges ?? null);
          return acc;
        },
        { songs: <(NeteaseTrack | null)[]>[], privileges: <(NeteaseTrackPrivilege | null)[]>[] }
      );
      if (result.songs.includes(null) || result.privileges.includes(null)) {
        return null;
      }
      return {
        songs: result.songs as NeteaseTrack[],
        privileges: result.privileges as NeteaseTrackPrivilege[]
      };
    });
}

export function cacheLyric(id: number, lyrics: NeteaseLyricResponse) {
  db.lyric.put({
    id,
    lyrics,
    updateTime: new Date().getTime()
  });
}

export function getLyricFromCache(id: number | string) {
  return db.lyric.get(Number(id)).then((result) => {
    if (!result) return null;
    Log.trace("ui/db:getLyric", `Loaded cached lyric for track ID 👉 ${id}`);
    return result.lyrics;
  });
}

export function cacheAlbum(id: number | string, album: NeteaseAlbumDetailResponse) {
  db.album.put({
    id: Number(id),
    album,
    updateTime: new Date().getTime()
  });
}

export function getAlbumFromCache(id: number | string) {
  return db.album.get(Number(id)).then((result) => {
    if (!result) return null;
    Log.trace("ui/db:getAlbum", `Loaded cached album for album ID 👉 ${id}`);
    return result.album;
  });
}

export function countDBSize() {
  const trackSizes: number[] = [];
  return db.trackSources
    .each((track) => trackSizes.push(track.source.byteLength))
    .then(() => {
      const res = {
        bytes: trackSizes.reduce((bytes, size) => bytes + size, 0),
        length: trackSizes.length
      };
      tracksCacheBytes = res.bytes;
      Log.trace("ui/db:countDBSize", `DB Size: ${res.bytes} bytes in ${res.length} tracks`);
      return res;
    });
}

export function clearDB() {
  return Promise.all(db.tables.map((table) => table.clear()));
}

export default db;
