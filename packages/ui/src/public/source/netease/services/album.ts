import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import _NeteaseTrackSource from "./track";
import { NeteaseAlbum, NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class _NeteaseAlbumSource {
  //region cache
  private static readonly cacheKey = "netease_album_detail_v2";

  private static storeCache(album: NeteaseAlbum) {
    CacheStore.memory.setOne(_NeteaseAlbumSource.cacheKey + "_" + album.content.id, album);
    return CacheStore.local.object.store(
      _NeteaseAlbumSource.cacheKey + "_" + album.content.id,
      album
    );
  }

  private static getCache(id: number) {
    const cache = CacheStore.memory.getOne<NeteaseAlbum>(_NeteaseAlbumSource.cacheKey + "_" + id);
    if (cache) return cache;
    return CacheStore.local.object
      .fetch<NeteaseAlbum>(_NeteaseAlbumSource.cacheKey + "_" + id)
      .then(NeteaseAlbum.fromObject);
  }

  //endregion

  private static requestFullTracks(ids: number[]) {
    return _NeteaseTrackSource.ids(ids).then((tracks) => {
      return tracks.map(
        (track) =>
          new NeteaseTrackRecord({
            detail: track,
            sourceID: track.al.id,
            sourceName: "album"
          })
      );
    });
  }

  static async id(id: number) {
    const cache = await _NeteaseAlbumSource.getCache(id);
    if (cache) return cache;

    const content = await NeteaseAPI.Album.content(id);
    const tracks = await _NeteaseAlbumSource.requestFullTracks(
      content.songs.map((song) => song.id)
    );
    const album = new NeteaseAlbum({
      content: content.album,
      tracks
    });

    await _NeteaseAlbumSource.storeCache(album);
    return album;
  }

  static dynamic<T extends Optional<number | NeteaseAlbum>>(
    id: T
  ): T extends Falsy ? null : Promise<NeteaseAPI.NeteaseAlbumDynamicDetailResponse> {
    const res = !id ? null : NeteaseAPI.Album.detail(typeof id === "number" ? id : id.content.id);
    return res as T extends Falsy ? null : Promise<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  }
}
