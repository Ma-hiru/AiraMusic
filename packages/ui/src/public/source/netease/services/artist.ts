import _NeteaseTrackSource from "./track";
import { NeteaseAPIArtist } from "@mahiru/ui/public/source/netease/api";
import { NeteaseArtist, NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class _NeteaseArtistSource {
  //region cache
  private static readonly cacheKey = "netease_artist_detail_v1";

  private static storeCache(album: NeteaseArtist) {
    CacheStore.memory.setOne(_NeteaseArtistSource.cacheKey + "_" + album.id, album);
    return CacheStore.local.object.store(_NeteaseArtistSource.cacheKey + "_" + album.id, album);
  }

  private static getCache(id: number) {
    const cache = CacheStore.memory.getOne<NeteaseArtist>(_NeteaseArtistSource.cacheKey + "_" + id);
    if (cache) return cache;
    return CacheStore.local.object.fetch<NeteaseArtist>(_NeteaseArtistSource.cacheKey + "_" + id);
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

  static async id(id: number): Promise<NeteaseArtist> {
    const followInfos = await NeteaseAPIArtist.followCount(id);

    const cache = await _NeteaseArtistSource.getCache(id);
    if (cache) {
      cache.followInfos = followInfos.data;
      return NeteaseArtist.fromObject(cache);
    }

    const detail = await NeteaseAPIArtist.detail(id);
    const desc = await NeteaseAPIArtist.desc(id);
    const hotTracks = await NeteaseAPIArtist.hotTracks(id).then(({ songs }) => {
      return _NeteaseArtistSource.requestFullTracks(songs.map((track) => track.id));
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
