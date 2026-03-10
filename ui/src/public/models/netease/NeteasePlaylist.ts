import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import NeteasePlaylistSummary, {
  NeteasePlaylistSummaryModel
} from "@mahiru/ui/public/models/netease/NeteasePlaylistSummary";

export default class NeteasePlaylist
  extends NeteasePlaylistSummary
  implements NeteasePlaylistModel
{
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
  //endregion

  //region static methods
  static fromNeteaseAPIs(
    playlist: NeteaseAPI.NeteasePlaylistDetail,
    privilege: NeteaseAPI.NeteaseTrackPrivilege
  ) {
    return new NeteasePlaylist({
      ...playlist,
      trackIds: playlist.trackIds.map((i) => i.id),
      tracks: playlist.tracks.map((t) => NeteaseTrack.fromNeteaseAPI(t, privilege))
    });
  }

  static fromNeteaseAPIResponse(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    const { playlist, privileges } = response;
    return new NeteasePlaylist({
      ...playlist,
      trackIds: playlist.trackIds.map((i) => i.id),
      tracks: playlist.tracks.map((t, index) => NeteaseTrack.fromNeteaseAPI(t, privileges[index]!))
    });
  }
  //endregion
}

//region Type Definitions
interface NeteasePlaylistModel extends NeteasePlaylistSummaryModel {
  commentCount: number;
  playlistType: string;
  shareCount: number;
  trackIds: number[];
  tracks: NeteaseTrack[];
}
//endregion
