import { RendererCache } from "@/common/lib/cache";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseArtist, NeteaseTrackRecord } from "@/common/netease/models";

import _NeteaseTrackSource from "./track";

export default class _NeteaseArtistSource {
  //region cache
  private static readonly cacheKey = "netease_artist_detail_v1";

  private static storeCache(album: NeteaseArtist) {
    RendererCache.memory.setOne<NeteaseArtist>(
      _NeteaseArtistSource.cacheKey + "_" + album.id,
      album
    );
    return RendererCache.service.object.setOne<NeteaseArtist>({
      id: _NeteaseArtistSource.cacheKey + "_" + album.id,
      data: album
    });
  }

  private static getCache(id: number) {
    const cache = RendererCache.memory.getOne<NeteaseArtist>(
      _NeteaseArtistSource.cacheKey + "_" + id
    );
    if (cache) return Promise.resolve(cache);
    return RendererCache.service.object
      .getOne<NeteaseArtist>(
        _NeteaseArtistSource.cacheKey + "_" + id,
        RendererFormat.timeLimit(1, "d")
      )
      .then((res) => {
        if (res) return NeteaseArtist.fromObject(res);
        return res;
      });
  }

  //endregion

  private static requestFullTracks(artistID: number, ids: number[], signal?: AbortSignal) {
    return _NeteaseTrackSource.ids(ids, 100, 5, signal).then((tracks) => {
      signal?.throwIfAborted();
      return tracks.map(
        (track) =>
          new NeteaseTrackRecord({
            detail: track,
            sourceID: artistID,
            sourceName: "other"
          })
      );
    });
  }

  static async id(id: number, signal?: AbortSignal): Promise<NeteaseArtist> {
    signal?.throwIfAborted();
    const followInfos = await NeteaseAPIArtist.followCount(id, signal);
    signal?.throwIfAborted();

    const cache = await _NeteaseArtistSource.getCache(id);
    signal?.throwIfAborted();
    if (cache) {
      cache.followInfos = followInfos.data;
      return cache;
    }

    const detail = await NeteaseAPIArtist.detail(id, signal);
    signal?.throwIfAborted();
    const desc = await NeteaseAPIArtist.desc(id, signal);
    signal?.throwIfAborted();
    const hotTracks = await NeteaseAPIArtist.hotTracks(id, signal).then(({ songs }) => {
      signal?.throwIfAborted();
      return _NeteaseArtistSource.requestFullTracks(
        id,
        songs.map((track) => track.id),
        signal
      );
    });
    signal?.throwIfAborted();

    const artist = NeteaseArtist.fromNeteaseAPIs({
      detail,
      desc,
      followInfos,
      hotTracks
    });

    signal?.throwIfAborted();
    await _NeteaseArtistSource.storeCache(artist);
    signal?.throwIfAborted();

    return artist;
  }
}
