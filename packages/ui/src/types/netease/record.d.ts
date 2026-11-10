namespace NeteaseAPI {
  interface NeteaseWeekReportResponse extends NeteaseAPIResponse {
    data: {
      type: string;
      endTime: number;
      startTime: number;
      listenTimeDistributionBlock: ListenTimeDistributionBlock;
    };
  }

  interface NeteaseSongPlayRankResponse extends NeteaseAPIResponse {
    data: {
      songItems: NeteaseSongPlayRankItem[];
    };
  }

  /** 周/月 Top20；歌曲详情通过 songId 获取，不将其他未核实字段用作详情。 */
  interface NeteaseSongPlayRankItem {
    songId: number;
    playCount: number;
  }

  interface NeteaseTodaySongsResponse extends NeteaseAPIResponse {
    data: {
      songDTOs: NeteaseTodaySong[];
    };
  }

  interface NeteaseTodaySong {
    picId: number;
    picUrl: string;
    songId: number;
    redStar: boolean;
    songName: string;
    aliasName: null | string;
    artists: NeteaseTodaySongArtist[];
    /** 最近一次播放时间（秒时间戳） */
    lastPlayTime: number;
  }

  interface NeteaseTodaySongArtist {
    artistId: number;
    artistName: string;
  }

  interface NeteaseRecentSongsResponse extends NeteaseAPIResponse {
    data: {
      total: number;
      list: NeteaseRecentSong[];
    };
  }

  interface NeteaseRecentSong {
    /** 最近一次播放时间（毫秒时间戳） */
    playTime: number;
    /** 该窗口内的播放次数 */
    playCount?: number;
    data: NeteaseRecordSong;
  }

  /** 听歌排行（/user/record）在 allData / weekData 中的单条记录 */
  interface NeteasePlayRecordResponse extends NeteaseAPIResponse {
    allData?: NeteasePlayRecordItem[];
    weekData?: NeteasePlayRecordItem[];
  }

  interface NeteasePlayRecordItem {
    playCount: number;
    /** 相对热度，0-100 */
    score: number;
    song: NeteaseRecordSong;
  }

  interface NeteaseRecordSong {
    id: number;
    dt?: number;
    name: string;
    al?: NeteaseRecordSongAlbum;
    ar?: NeteaseRecordSongArtist[];
  }

  interface NeteaseRecordSongArtist {
    id: number;
    name: string;
    picUrl?: null | string;
  }

  interface NeteaseRecordSongAlbum {
    id: number;
    name: string;
    picUrl?: null | string;
  }

  interface NeteaseWeekDurationResponse extends NeteaseAPIResponse {
    data: NeteaseWeekDuration;
  }

  interface NeteaseWeekDuration {
    type: string;
    endTime: number;
    startTime: number;
    userNickName: null;
    weekTodayListenBlock: WeekTodayListenBlock;
    weekFriendsListenBlock: WeekFriendsListenBlock;
    listenTimeDistributionBlock: ListenTimeDistributionBlock;
  }

  interface ListenTimeDistributionBlock {
    sections: null;
    blockType: string;
    listenDays: number;
    sleepTdBlock: null;
    playDuration: number;
    achievementTitle: null;
    listenDataHelper: null;
    durationDetails: DurationDetail[];
    achievementTitleGeneratorClient: null;
  }

  interface DurationDetail {
    period: string;
    duration: number;
    reachLimit: boolean;
    podcastDuration: number;
    audiobookDuration: number;
  }

  interface WeekFriendsListenBlock {
    friendListenRecords: FriendListenRecord[];
  }

  interface FriendListenRecord {
    songId: number;
    userId: number;
    artistId: number;
    collect: boolean;
    songName: string;
    username: string;
    artistName: string;
    songPicUrl: string;
    userAvatar: string;
    artistPicUrl: string;
    latestListenTime: number;
  }

  interface WeekTodayListenBlock {
    redCount: number;
    songCount: number;
    coverUrls: string[];
  }

  interface NeteaseMonthDurationResponse extends NeteaseAPIResponse {
    code: number;
    message: string;
    data: NeteaseMonthDuration;
  }

  interface NeteaseMonthDuration {
    type: string;
    endTime: number;
    startTime: number;
    userNickName: null;
    listenTimeDistributionBlock: ListenTimeDistributionBlock;
  }

  interface ListenTimeDistributionBlock {
    sections: null;
    blockType: string;
    listenDays: number;
    playDuration: number;
    achievementTitle: null;
    listenDataHelper: null;
    sleepTdBlock: SleepTdBlock;
    durationDetails: DurationDetail[];
    achievementTitleGeneratorClient: null;
  }

  interface DurationDetail {
    period?: string;
    duration?: number;
    reachLimit?: boolean;
    podcastDuration?: number;
    audiobookDuration?: number;
  }

  interface SleepTdBlock {
    sleepScene: null;
    sleepListenDays: number;
    maxDayPlayDuration: null;
    sleepPlayDuration: number;
    avgDayPlayDuration: number;
    maxDayPlayDurationPeriod: null;
    sleepDurationDetails: SleepDurationDetail[];
  }

  interface SleepDurationDetail {
    period?: string;
    duration?: number;
    reachLimit?: boolean;
    podcastDuration?: number;
    audiobookDuration?: number;
  }
}
