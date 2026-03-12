import NeteasePlaylistSummary from "@mahiru/ui/public/models/netease/NeteasePlaylistSummary";
import { Persistable } from "@mahiru/ui/public/models/persistable";
import NeteaseCookie from "@mahiru/ui/public/models/netease/NeteaseCookie";

export default class NeteaseUser implements Persistable<NeteaseUser>, NeteaseUserModel {
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

  //region persistable
  fromJSON(json: string) {
    const obj = JSON.parse(json);
    return new NeteaseUser({
      profile: obj.profile,
      refreshCookiesDate: obj.refreshCookiesDay,
      likedTrackIDs: obj.likedTrackIDs,
      likedPlaylist: obj.likedPlaylist,
      starPlaylists: obj.starPlaylists,
      userPlaylists: obj.userPlaylist
    });
  }

  toJSON() {
    return JSON.stringify(this);
  }
  //endregion

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

  static get isLoggedIn() {
    return NeteaseCookie.isLoggedIn();
  }
}

interface NeteaseUserModel {
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
