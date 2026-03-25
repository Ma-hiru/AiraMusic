import { NeteasePlaylistSummary } from "./NeteasePlaylistSummary";
import { NeteaseCookie } from "./NeteaseCookie";

export class NeteaseUser implements NeteaseUserModel {
  //region fields
  readonly refreshCookiesDate;
  readonly profile;
  readonly likedTrackIDs;
  readonly likedPlaylist;
  readonly starPlaylists;
  readonly userPlaylists;

  constructor(props: NeteaseUserModel) {
    this.profile = props.profile;
    this.likedTrackIDs = props.likedTrackIDs;
    this.likedPlaylist = props.likedPlaylist;
    this.starPlaylists = props.starPlaylists;
    this.userPlaylists = props.userPlaylists;
    this.refreshCookiesDate = props.refreshCookiesDate;
  }

  //endregion

  copyWith(props: Partial<NeteaseUserModel>) {
    return new NeteaseUser({
      profile: props.profile || this.profile,
      likedTrackIDs: props.likedTrackIDs || this.likedTrackIDs,
      likedPlaylist: props.likedPlaylist || this.likedPlaylist,
      starPlaylists: props.starPlaylists || this.starPlaylists,
      userPlaylists: props.userPlaylists || this.userPlaylists,
      refreshCookiesDate: props.refreshCookiesDate || this.refreshCookiesDate
    });
  }

  get isLoggedIn() {
    return NeteaseCookie.isLoggedIn();
  }

  isVIP() {
    return this.profile.vipType === 11;
  }

  get playlistCount() {
    return this.userPlaylists.length + this.starPlaylists.length;
  }

  static fromNeteaseAPI(props: {
    refreshCookiesDate?: number;
    profile: NeteaseAPI.NeteaseUserDetailResponse["profile"];
    likedTrackIDs: {
      ids: Record<number, boolean>;
      checkPoint: number;
    };
    likedPlaylist: NeteaseAPI.NeteasePlaylistSummary;
    starPlaylists: NeteaseAPI.NeteasePlaylistSummary[];
    userPlaylists: NeteaseAPI.NeteasePlaylistSummary[];
  }) {
    props.refreshCookiesDate ??= new Date().getDate();
    return new NeteaseUser({
      refreshCookiesDate: props.refreshCookiesDate,
      profile: props.profile,
      likedTrackIDs: props.likedTrackIDs,
      likedPlaylist: NeteasePlaylistSummary.fromNeteaseAPI(props.likedPlaylist),
      starPlaylists: props.starPlaylists.map(NeteasePlaylistSummary.fromNeteaseAPI),
      userPlaylists: props.userPlaylists.map(NeteasePlaylistSummary.fromNeteaseAPI)
    });
  }

  static fromObject(user: Optional<NeteaseUserModel>) {
    if (!user) return null;
    return new NeteaseUser(user);
  }

  static get isLoggedIn() {
    return NeteaseCookie.isLoggedIn();
  }

  static isVIP(user: Optional<NeteaseUser | NeteaseUserModel>) {
    return user?.profile.vipType === 11;
  }
}

export interface NeteaseUserModel {
  profile: NeteaseAPI.NeteaseUserDetailResponse["profile"];
  likedTrackIDs: {
    ids: Record<number, boolean>;
    checkPoint: number;
  };
  refreshCookiesDate: number;
  likedPlaylist: NeteasePlaylistSummary;
  starPlaylists: NeteasePlaylistSummary[];
  userPlaylists: NeteasePlaylistSummary[];
}
