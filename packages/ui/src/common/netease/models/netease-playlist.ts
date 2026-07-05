import { NeteaseTrack } from "./netease-track";
import { NeteasePlaylistSummary } from "./netease-playlist-summary";

/**
 * 可能存在请求歌单额外歌曲的 privileges 时，请求错误或者返回空数据的情况， \
 * 不能断言另外的 privileges 一定存在， \
 * 固让privileges可选，无法得到 privileges 的歌曲，内部判断 playable 时会处理为 false \
 * 而不让 NeteaseAPI.NeteasePlaylistDetailResponse 内部privileges可选是因为  \
 * 如果不请求额外的 privileges ，歌曲privileges是一定附加在privileges字段且存在的 \
 * 这是符合预期的, NeteaseAPI.NeteasePlaylistDetailResponse <: NullablePrivilegesPlaylistDetailResponse
 * */
// prettier-ignore
export type NullablePrivilegesPlaylistDetailResponse = {
  privileges: (null | NeteaseAPI.NeteaseTrackPrivilege)[];
} & Omit<
  NeteaseAPI.NeteasePlaylistDetailResponse,
  "privileges"
>;

export class NeteasePlaylist extends NeteasePlaylistSummary implements NeteasePlaylistModel {
  //region fields
  readonly commentCount: number;
  readonly playlistType: string;
  readonly shareCount: number;
  readonly trackIds: number[];
  readonly tracks: NeteaseTrack[];

  constructor(props: NeteasePlaylistModel) {
    super(props);
    this.commentCount = props.commentCount;
    this.playlistType = props.playlistType;
    this.shareCount = props.shareCount;
    this.trackIds = props.trackIds;
    this.tracks = props.tracks;
  }

  override toToolJSONValue(): JsonValue {
    return {
      ...(super.toToolJSONValue() as object),
      commentCount: this.commentCount,
      playlistType: this.playlistType,
      shareCount: this.shareCount,
      trackIds: undefined,
      tracks: this.tracks.map((track) => ({ id: track.id, name: track.name }))
    } as unknown as JsonValue;
  }
  //endregion

  //region static methods
  static fromNeteaseAPIs(
    playlist: NeteaseAPI.NeteasePlaylistDetail,
    privilege: Nullable<NeteaseAPI.NeteaseTrackPrivilege>
  ) {
    return new NeteasePlaylist({
      ...playlist,
      trackIds: playlist.trackIds.map((i) => i.id),
      tracks: playlist.tracks.map((t) => NeteaseTrack.fromNeteaseAPI(t, privilege))
    });
  }

  static fromNeteaseAPIResponse(response: NullablePrivilegesPlaylistDetailResponse) {
    const { playlist, privileges } = response;
    return new NeteasePlaylist({
      ...playlist,
      trackIds: playlist.trackIds.map((i) => i.id),
      tracks: playlist.tracks.map((t, index) =>
        NeteaseTrack.fromNeteaseAPI(t, privileges[index] ?? null)
      )
    });
  }
  //endregion
}

//region Type Definitions
interface NeteasePlaylistModel extends NeteasePlaylistSummaryModel {
  shareCount: number;
  trackIds: number[];
  commentCount: number;
  playlistType: string;
  tracks: NeteaseTrack[];
}
//endregion
