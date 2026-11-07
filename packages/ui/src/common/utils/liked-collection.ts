import { PlaylistCollectionIndex } from "@mahiru/wasm";
import type { NeteaseTrack } from "@/common/netease/models";

export type LikedArtist = {
  id: number;
  key: string;
  name: string;
  covers: string[];
  trackIDs: number[];
};

export type LikedAlbum = {
  id: number;
  key: string;
  name: string;
  artist: string;
  cover?: string;
  trackIDs: number[];
};

export type LikedCollection = {
  duration: number;
  albumCount: number;
  albums: LikedAlbum[];
  artists: LikedArtist[];
};

export function serializeCollectionTracks(tracks: readonly NeteaseTrack[]): string {
  return JSON.stringify(
    tracks.map(({ id, al, ar, dt, tns, alia, name }) => ({ id, name, ar, al, dt, alia, tns }))
  );
}

export function readLikedCollection(index: PlaylistCollectionIndex): LikedCollection {
  return JSON.parse(index.snapshot());
}

export function createLikedCollection(tracks: readonly NeteaseTrack[]): LikedCollection {
  const index = new PlaylistCollectionIndex();
  try {
    index.update(serializeCollectionTracks(tracks));
    return readLikedCollection(index);
  } finally {
    index.free();
  }
}

export function formatCollectionDuration(duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return "0 分钟";
  const minutes = Math.floor(duration / 60000);
  if (minutes === 0) return "不足 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}
