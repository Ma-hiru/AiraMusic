export class NeteasePlaylistSummary implements NeteasePlaylistSummaryModel {
  //region fields
  readonly description: string;
  readonly coverImgUrl: string;
  readonly createTime: number;
  readonly creator: {
    readonly userId: number;
    readonly nickname: string;
    readonly avatarUrl: string;
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
    this.description = props.description || "";
  }
  //endregion

  /** @deprecated Agent 输出请统一使用 RendererTool.object 或 RendererTool.playlist。 */
  toToolJSONValue(): JsonValue {
    return {
      ...this
    } as unknown as JsonValue;
  }

  playCountFormat() {
    if (!this.playCount) return "0";
    if (this.playCount >= 100000000) {
      return (this.playCount / 100000000).toFixed(1) + "亿";
    } else if (this.playCount >= 10000) {
      return (this.playCount / 10000).toFixed(1) + "万";
    } else {
      return this.playCount.toString();
    }
  }

  //region static methods
  static fromNeteaseAPI(playlist: NeteaseAPI.NeteasePlaylistSummary) {
    return new NeteasePlaylistSummary(playlist);
  }

  static isPrivacy(playlist: NeteasePlaylistSummaryModel | NeteaseAPI.NeteasePlaylistSummary) {
    return playlist?.privacy === 10;
  }
  //endregion
}
