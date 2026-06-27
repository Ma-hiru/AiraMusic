import _NeteaseTrackSource from "./track";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { NeteaseAlbum, NeteaseTrackRecord } from "@/common/netease/models";
import { RendererCache } from "@/common/lib/cache";

export default class _NeteaseAlbumSource {
  //region cache
  private static readonly cacheKey = "netease_album_detail_v4";

  private static storeCache(album: NeteaseAlbum) {
    RendererCache.memory.setOne<NeteaseAlbum>(
      _NeteaseAlbumSource.cacheKey + "_" + album.content.id,
      album
    );
    return RendererCache.service.object.setOne<NeteaseAlbum>({
      id: _NeteaseAlbumSource.cacheKey + "_" + album.content.id,
      data: album
    });
  }

  private static getCache(id: number) {
    const cache = RendererCache.memory.getOne<NeteaseAlbum>(
      _NeteaseAlbumSource.cacheKey + "_" + id
    );
    if (cache) return Promise.resolve(cache);
    return RendererCache.service.object
      .getOne<NeteaseAlbum>(_NeteaseAlbumSource.cacheKey + "_" + id)
      .then((res) => {
        if (res) return NeteaseAlbum.fromObject(res);
        return res;
      });
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
    if (cache && cache.tracks.length) return cache;

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
