import _NeteaseTrackSource from "./track";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { NeteaseAlbum, NeteaseTrackRecord } from "@/common/netease/models";
import { RendererCache } from "@/common/lib/cache";

export default class _NeteaseAlbumSource {
  //region cache
  private static readonly cacheKey = "netease_album_detail_v4";

  private static storeCache(album: NeteaseAlbum) {
    RendererCache.memory.setOne(_NeteaseAlbumSource.cacheKey + "_" + album.content.id, album);
    return RendererCache.local.object.store(
      _NeteaseAlbumSource.cacheKey + "_" + album.content.id,
      album
    );
  }

  private static getCache(id: number) {
    const cache = RendererCache.memory.getOne<NeteaseAlbum>(
      _NeteaseAlbumSource.cacheKey + "_" + id
    );
    if (cache) return cache;
    return RendererCache.local.object.fetch<NeteaseAlbum>(_NeteaseAlbumSource.cacheKey + "_" + id);
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

  static async id(id: number): Promise<NeteaseAlbum> {
    const cache = await _NeteaseAlbumSource.getCache(id);
    if (cache) return NeteaseAlbum.fromObject(cache);

    const content = await NeteaseAPIAlbum.content(id);
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
    const res = !id ? null : NeteaseAPIAlbum.detail(typeof id === "number" ? id : id.content.id);
    return res as T extends Falsy ? null : Promise<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  }
}
