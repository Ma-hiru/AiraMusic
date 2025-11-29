import Dexie, { Table } from "dexie";
import { Log } from "@mahiru/ui/utils/dev";
import {
  NeteaseAlbumDetailResponse,
  NeteaseLyricResponse,
  NeteaseTrack,
  NeteaseTrackPrivilege
} from "@mahiru/ui/types/netease-api";

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
