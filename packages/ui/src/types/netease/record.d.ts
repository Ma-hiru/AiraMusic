namespace NeteaseAPI {
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
