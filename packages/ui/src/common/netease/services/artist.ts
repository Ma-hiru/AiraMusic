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

  private static requestFullTracks(artistID: number, ids: number[]) {
    return _NeteaseTrackSource.ids(ids).then((tracks) => {
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

  static async id(id: number): Promise<NeteaseArtist> {
    const followInfos = await NeteaseAPIArtist.followCount(id);

    const cache = await _NeteaseArtistSource.getCache(id);
    if (cache) {
      cache.followInfos = followInfos.data;
      return cache;
    }

    const detail = await NeteaseAPIArtist.detail(id);
    const desc = await NeteaseAPIArtist.desc(id);
    const hotTracks = await NeteaseAPIArtist.hotTracks(id).then(({ songs }) => {
      return _NeteaseArtistSource.requestFullTracks(
        id,
        songs.map((track) => track.id)
      );
    });

    const artist = NeteaseArtist.fromNeteaseAPIs({
      detail,
      desc,
      followInfos,
      hotTracks
    });

    await _NeteaseArtistSource.storeCache(artist);

    return artist;
  }
}
