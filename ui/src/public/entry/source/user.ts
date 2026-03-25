import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseCookie, NeteaseUser } from "@mahiru/ui/public/models/netease";
import NCM_API from "@mahiru/ui/public/api";

export default class _NeteaseUserSource {
  private static async getUserPlaylist(uid: number) {
    if (uid) {
      const { playlist } = await NCM_API.User.playlist({ uid, limit: 30 });
      const userPlaylists: NeteaseAPI.NeteasePlaylistSummary[] = [];
      const starPlaylists: NeteaseAPI.NeteasePlaylistSummary[] = [];
      const likedPlaylist: NeteaseAPI.NeteasePlaylistSummary = playlist.shift()!;

      playlist.forEach((item) => {
        if (item.creator.userId === uid) {
          userPlaylists.push(item);
        } else {
          starPlaylists.push(item);
        }
      });

      return {
        userPlaylists,
        starPlaylists,
        likedPlaylist
      };
    }

    return null;
  }

  private static async getUserProfile(uid: number) {
    const [detailResponse, likedResponse] = await Promise.allSettled([
      NCM_API.User.detail(uid),
      NCM_API.User.likedTracks(uid)
    ]);

    if (detailResponse.status === "fulfilled" && likedResponse.status === "fulfilled") {
      const profile = detailResponse.value.profile;
      const { ids, checkPoint } = likedResponse.value;
      const idsSet: Record<number, boolean> = {};
      ids.forEach((id) => (idsSet[id] = true));
      return {
        profile,
        likedTrackIDs: {
          ids: idsSet,
          checkPoint
        }
      };
    }

    return null;
  }

  static async refresh(user: { userId: number; refreshCookiesDate?: number }) {
    try {
      if (!NeteaseCookie.isLoggedIn()) return null;
      const uid = user.userId;
      let refreshCookiesDate = user.refreshCookiesDate ?? new Date().getDate();
      if (refreshCookiesDate !== new Date().getDate()) {
        await NeteaseCookie.refresh();
        Log.debug("refresh cookies");
        refreshCookiesDate = new Date().getDate();
      }

      const userProfile = await _NeteaseUserSource.getUserProfile(uid);
      if (!userProfile) return null;
      const userPlaylist = await _NeteaseUserSource.getUserPlaylist(uid);
      if (!userPlaylist) return null;

      Log.debug("refresh user info");
      return NeteaseUser.fromNeteaseAPI({
        ...userProfile,
        ...userPlaylist,
        refreshCookiesDate
      });
    } catch (err) {
      Log.error(`refresh user info error: ${err}`);
      return null;
    }
  }

  static async fromCookies(cookies?: Optional<string>) {
    cookies && NeteaseCookie.set(cookies);
    if (NeteaseCookie.isLoggedIn()) {
      const { profile } = await NCM_API.User.account();
      return await _NeteaseUserSource.refresh(profile);
    } else {
      Log.error("no cookies");
      return null;
    }
  }

  static async logout() {
    await NCM_API.Auth.logout();
    NeteaseCookie.clearLoggedIn();
  }
}
