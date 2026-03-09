

export default class NeteasePlaylistSummray implements NeteasePlaylistModel {
  //region fields
  commentCount: number;
  coverImgUrl: string;
  createTime: number;
  creator: { avatarUrl: string; nickname: string; signature: string };
  highQuality: boolean;
  id: number;
  name: string;
  playCount: number;
  playlistType: string;
  privacy: number;
  shareCount: number;
  subscribed: boolean;
  subscribedCount: number;
  tags: string[];
  trackCount: number;
  trackIds: number[];
  trackNumberUpdateTime: number;
  trackUpdateTime: number;
  tracks: NeteaseTrack[];
  updateTime: number;
  userId: number;

  constructor(props: NeteasePlaylistModel) {
    this.commentCount = props.commentCount;
    this.coverImgUrl = props.coverImgUrl;
    this.createTime = props.createTime;
    this.creator = props.creator;
    this.highQuality = props.highQuality;
    this.id = props.id;
    this.name = props.name;
    this.playCount = props.playCount;
    this.playlistType = props.playlistType;
    this.privacy = props.privacy;
    this.shareCount = props.shareCount;
    this.subscribed = props.subscribed;
    this.subscribedCount = props.subscribedCount;
    this.tags = props.tags;
    this.trackCount = props.trackCount;
    this.trackIds = props.trackIds;
    this.trackNumberUpdateTime = props.trackNumberUpdateTime;
    this.trackUpdateTime = props.trackUpdateTime;
    this.tracks = props.tracks;
    this.updateTime = props.updateTime;
    this.userId = props.userId;
  }
  //endregion

  playCountFormat(playcount?: number) {
    if (!playcount) return "0";
    if (playcount >= 100000000) {
      return (playcount / 100000000).toFixed(1) + "亿";
    } else if (playcount >= 10000) {
      return (playcount / 10000).toFixed(1) + "万";
    } else {
      return playcount.toString();
    }
  }

  //region static methods
  static fromNeteaseAPI(
    playlist: NeteaseAPI.NeteasePlaylistDetail,
    privilege: NeteaseAPI.NeteaseTrackPrivilege
  ) {
    return new NeteasePlaylist({
      ...playlist,
      trackIds: playlist.trackIds.map((i) => i.id),
      tracks: playlist.tracks.map((t) => NeteaseTrack.fromNeteaseAPI(t, privilege))
    });
  }
  //endregion
}

//region Type Definitions
interface NeteasePlaylistModel {
  commentCount: number;
  coverImgUrl: string;
  createTime: number;
  creator: {
    avatarUrl: string;
    nickname: string;
    signature: string;
  };
  highQuality: boolean;
  id: number;
  name: string;
  playCount: number;
  playlistType: string;
  privacy: number;
  shareCount: number;
  subscribed: boolean;
  subscribedCount: number;
  tags: string[];
  trackCount: number;
  trackIds: number[];
  tracks: NeteaseTrack[];
  trackNumberUpdateTime: number;
  trackUpdateTime: number;
  updateTime: number;
  userId: number;
}
//endregion
