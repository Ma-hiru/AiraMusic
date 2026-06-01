namespace NeteaseAPI {
  interface NeteaseWeekDurationResponse extends NeteaseAPIResponse {
    data: NeteaseWeekDuration;
  }

  interface NeteaseWeekDuration {
    endTime: number;
    listenTimeDistributionBlock: ListenTimeDistributionBlock;
    startTime: number;
    type: string;
    userNickName: null;
    weekFriendsListenBlock: WeekFriendsListenBlock;
    weekTodayListenBlock: WeekTodayListenBlock;
  }

  interface ListenTimeDistributionBlock {
    achievementTitle: null;
    achievementTitleGeneratorClient: null;
    blockType: string;
    durationDetails: DurationDetail[];
    listenDataHelper: null;
    listenDays: number;
    playDuration: number;
    sections: null;
    sleepTdBlock: null;
  }

  interface DurationDetail {
    audiobookDuration: number;
    duration: number;
    period: string;
    podcastDuration: number;
    reachLimit: boolean;
  }

  interface WeekFriendsListenBlock {
    friendListenRecords: FriendListenRecord[];
  }

  interface FriendListenRecord {
    artistId: number;
    artistName: string;
    artistPicUrl: string;
    collect: boolean;
    latestListenTime: number;
    songId: number;
    songName: string;
    songPicUrl: string;
    userAvatar: string;
    userId: number;
    username: string;
  }

  interface WeekTodayListenBlock {
    coverUrls: string[];
    redCount: number;
    songCount: number;
  }

  interface NeteaseMonthDurationResponse extends NeteaseAPIResponse {
    code: number;
    data: NeteaseMonthDuration;
    message: string;
  }

  interface NeteaseMonthDuration {
    endTime: number;
    listenTimeDistributionBlock: ListenTimeDistributionBlock;
    startTime: number;
    type: string;
    userNickName: null;
  }

  interface ListenTimeDistributionBlock {
    achievementTitle: null;
    achievementTitleGeneratorClient: null;
    blockType: string;
    durationDetails: DurationDetail[];
    listenDataHelper: null;
    listenDays: number;
    playDuration: number;
    sections: null;
    sleepTdBlock: SleepTdBlock;
  }

  interface DurationDetail {
    audiobookDuration?: number;
    duration?: number;
    period?: string;
    podcastDuration?: number;
    reachLimit?: boolean;
  }

  interface SleepTdBlock {
    avgDayPlayDuration: number;
    maxDayPlayDuration: null;
    maxDayPlayDurationPeriod: null;
    sleepDurationDetails: SleepDurationDetail[];
    sleepListenDays: number;
    sleepPlayDuration: number;
    sleepScene: null;
  }

  interface SleepDurationDetail {
    audiobookDuration?: number;
    duration?: number;
    period?: string;
    podcastDuration?: number;
    reachLimit?: boolean;
  }
}
