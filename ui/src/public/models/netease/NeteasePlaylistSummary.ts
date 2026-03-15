export class NeteasePlaylistSummary implements NeteasePlaylistSummaryModel {
  //region fields
  readonly coverImgUrl: string;
  readonly createTime: number;
  readonly creator: {
    readonly avatarUrl: string;
    readonly nickname: string;
    readonly signature: string;
  };
  readonly highQuality: boolean;
  readonly id: number;
  readonly name: string;
  readonly playCount: number;
  readonly privacy: number;
  readonly subscribed: boolean;
  readonly subscribedCount: number;
  readonly tags: string[];
  readonly trackCount: number;
  readonly trackNumberUpdateTime: number;
  readonly trackUpdateTime: number;
  readonly updateTime: number;
  readonly userId: number;

  constructor(props: NeteasePlaylistSummaryModel) {
    this.coverImgUrl = props.coverImgUrl;
    this.createTime = props.createTime;
    this.creator = props.creator;
    this.highQuality = props.highQuality;
    this.id = props.id;
    this.name = props.name;
    this.playCount = props.playCount;
    this.privacy = props.privacy;
    this.subscribed = props.subscribed;
    this.subscribedCount = props.subscribedCount;
    this.tags = props.tags;
    this.trackCount = props.trackCount;
    this.trackNumberUpdateTime = props.trackNumberUpdateTime;
    this.trackUpdateTime = props.trackUpdateTime;
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
  static fromNeteaseAPI(playlist: NeteaseAPI.NeteasePlaylistSummary) {
    return new NeteasePlaylistSummary(playlist);
  }
  //endregion
}

//region Type Definitions
export interface NeteasePlaylistSummaryModel {
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
  privacy: number;
  subscribed: boolean;
  subscribedCount: number;
  tags: string[];
  trackCount: number;
  trackNumberUpdateTime: number;
  trackUpdateTime: number;
  updateTime: number;
  userId: number;
}
//endregion
