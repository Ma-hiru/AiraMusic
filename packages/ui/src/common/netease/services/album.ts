import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { PreloadManager } from "@/common/utils/preload-manager";
import { NeteaseServicesImage } from "@/common/netease/services/index";
import { NeteaseAlbum, NeteaseTrackRecord, NeteaseNetworkImage } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";

import _NeteaseTrackSource from "./track";

/** 专辑数据信息永不缓存 */
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

  private static removeCache(id: number) {
    RendererCache.memory.deleteOne(_NeteaseAlbumSource.cacheKey + "_" + id);
    return RendererCache.service.object.setOne({
      id: _NeteaseAlbumSource.cacheKey + "_" + id,
      data: null
    });
  }

  //endregion

  private static requestFullTracks(ids: number[], signal?: AbortSignal) {
    return _NeteaseTrackSource.ids(ids, 100, 5, signal).then((tracks) => {
      signal?.throwIfAborted();
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

  static async id(id: number, signal?: AbortSignal): Promise<NeteaseAlbum> {
    signal?.throwIfAborted();
    const cache = await _NeteaseAlbumSource.getCache(id);
    signal?.throwIfAborted();
    if (cache && cache.tracks.length) return cache;

    const content = await NeteaseAPIAlbum.content(id, signal);
    signal?.throwIfAborted();
    const tracks = await _NeteaseAlbumSource.requestFullTracks(
      content.songs.map((song) => song.id),
      signal
    );
    signal?.throwIfAborted();
    const album = new NeteaseAlbum({
      content: content.album,
      tracks
    });

    signal?.throwIfAborted();
    await _NeteaseAlbumSource.storeCache(album);
    signal?.throwIfAborted();

    return album;
  }

  static dynamic<T extends Optional<number | NeteaseAlbum>>(
    id: T
  ): T extends Falsy ? null : Promise<NeteaseAPI.NeteaseAlbumDynamicDetailResponse> {
    const res = !id ? null : NeteaseAPIAlbum.detail(typeof id === "number" ? id : id.content.id);
    return res as T extends Falsy ? null : Promise<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  }

  private static preloadManager = new PreloadManager<number>({
    name: "album",
    exec: async (id, signal) => {
      const cache = await _NeteaseAlbumSource.getCache(id);
      signal?.throwIfAborted();
      if (cache && cache.tracks.length) return;
      const content = await NeteaseAPIAlbum.content(id, signal);
      signal?.throwIfAborted();
      NeteaseServicesImage.preload([
        NeteaseNetworkImage.fromURL(content.album.picUrl).setSize(
          RendererImageConstants.AlbumPageCoverSize
        ),
        ...content.songs.map((song) =>
          NeteaseNetworkImage.fromURL(song.al.picUrl).setSize(
            RendererImageConstants.PlaylistPageTrackCoverSize
          )
        )
      ]);
    }
  });

  static preload(id: number) {
    return _NeteaseAlbumSource.preloadManager.preload(id);
  }

  static cancelPreload(id: number) {
    return _NeteaseAlbumSource.preloadManager.cancelPreload(id);
  }

  /** 失效专辑缓存（不含专辑数据，因为其永不缓存） */
  static invalidate(id: number) {
    return _NeteaseAlbumSource.removeCache(id);
  }
}
