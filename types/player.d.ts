interface NeteaseTrackModel extends NeteaseAPI.NeteaseTrackBase {
  al: NeteaseAPI.Al;
  ar: NeteaseAPI.Ar[];
  fee: 0 | 1 | 4 | 8;
  mv: number;
  no: number;
  originCoverType: 0 | 1 | 2;
  pop: number;
  publishTime: number;
  noCopyrightRcmd: any;
  privilege: NeteaseAPI.NeteaseTrackPrivilege;
}

interface NeteasePlaylistCreatorModel {
  userId: number;
  avatarUrl: string;
  nickname: string;
  signature: string;
}

interface NeteasePlaylistSummaryModel {
  coverImgUrl: string;
  createTime: number;
  description: Nullable<string>;
  creator: NeteasePlaylistCreatorModel;
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
