import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Auth } from "@mahiru/ui/utils/auth";
import { API } from "@mahiru/ui/api";
import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";

@AddStoreSnapshot
class TaskClass {
  /** 登录接口 */
  refreshLogin = async (cookies: string) => {
    Log.trace("Logged in successfully, fetching user data...");
    try {
      Auth.setCookies(cookies);
      await Promise.all([
        this.refreshUserProfile(true),
        this.refreshUserPlaylist(true),
        this.refreshUserLikedTrackIDs(true)
      ]);
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts:refreshLogin",
          message: "failed to fetch user data after login.",
          raw: err
        })
      );
      void Auth.doLogout();
    }
  };
  /** 登录状态下，刷新Cookie */
  refreshCookieTask = async () => {
    try {
      if (!Auth.isAccountLoggedIn()) return;
      Log.trace("refresh cookie");
      await API.Auth.refreshCookie();
      const { UpdateUserLastRefreshCookieDate } = this.userSnapshot;
      UpdateUserLastRefreshCookieDate(new Date().getDate());
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts:refreshCookieTask",
          message: "refresh cookie failed",
          raw: err
        })
      );
    }
  };
  /** 登录状态下，刷新用户信息 */
  refreshUserProfile = async (login: boolean = false) => {
    try {
      if (!Auth.isAccountLoggedIn() && !login) return;
      Log.trace("refresh user profile");
      const account = await API.User.userAccount();
      const detail = await API.User.userDetail(account.profile.userId);

      const { UpdateUserProfile } = this.userSnapshot;
      UpdateUserProfile(detail.profile, "account");
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts:refreshUserProfile",
          message: "refresh user profile failed",
          raw: err
        })
      );
    }
  };
  /** 登录状态下，只包含歌单的id、描述、封面 */
  refreshUserPlaylist = async (login: boolean = false) => {
    try {
      if (!Auth.isAccountLoggedIn() && !login) return;
      Log.trace("refresh user playlist");

      const {
        UserProfile,
        UpdateUserLikedListSummary,
        UpdateUserPlaylistSummary,
        UpdateUserFavoriteListsSummary
      } = this.userSnapshot;
      const uid = UserProfile?.userId;
      if (uid) {
        const { playlist } = await API.User.userPlaylist({ uid, limit: 30 });
        const userPlaylist: NeteasePlaylistSummary[] = [];
        const userFavoriteLists: NeteasePlaylistSummary[] = [];
        const userLikedList = playlist.shift();

        playlist.forEach((item) => {
          if (item.creator.userId === uid) {
            userPlaylist.push(item);
          } else {
            userFavoriteLists.push(item);
          }
        });

        UpdateUserLikedListSummary(userLikedList || null);
        UpdateUserFavoriteListsSummary(userFavoriteLists);
        UpdateUserPlaylistSummary(userPlaylist);
      }
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts:refreshUserPlaylist",
          message: "refresh user playlist failed",
          raw: err
        })
      );
    }
  };
  /** 登录状态下，获取喜欢歌曲列表，在使用喜欢或不喜欢后应该刷新 */
  refreshUserLikedTrackIDs = async (login: boolean = false) => {
    try {
      if (!Auth.isAccountLoggedIn() && !login) return;
      Log.trace("refresh user liked track IDs");
      const { UserProfile, UpdateUserLikedTrackIDs } = this.userSnapshot;
      const uid = UserProfile?.userId;
      if (uid) {
        const { ids, checkPoint } = await API.User.userLikedSongsIDs(uid);
        const idsSet: Record<number, boolean> = {};
        ids.forEach((id) => (idsSet[id] = true));
        UpdateUserLikedTrackIDs({ ids: idsSet, checkPoint });
      }
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts:refreshUserLikedTrackIDs",
          message: "refresh user liked track IDs failed",
          raw: err
        })
      );
    }
  };
}
interface TaskClass extends WithStoreSnapshot {}

export const Task = new TaskClass();
