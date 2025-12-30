import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Auth } from "@mahiru/ui/utils/auth";
import { API } from "@mahiru/ui/api";
import { getUserStoreSnapshot } from "@mahiru/ui/store/user";

/** 登录接口 */
export async function refreshLogin(cookies: string) {
  Log.debug("Logged in successfully, fetching user data...");
  try {
    Auth.setCookies(cookies);
    await refreshUserProfile(true);
    await refreshUserPlaylist(true);
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/utils/login.ts",
        message: "Failed to fetch user data after login.",
        raw: err
      })
    );
    void Auth.doLogout();
  }
}
/** 登录状态下，刷新Cookie */
export async function refreshCookieTask() {
  try {
    if (!Auth.isAccountLoggedIn()) return;
    Log.trace("refresh cookie");
    await API.Auth.refreshCookie();
    const { UpdateUserLastRefreshCookieDate } = getUserStoreSnapshot();
    UpdateUserLastRefreshCookieDate(new Date().getDate());
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/common.ts:refreshCookieTask",
        message: "refresh cookie failed",
        raw: err
      })
    );
  }
}
/** 登录状态下，刷新用户信息 */
export async function refreshUserProfile(login: boolean = false) {
  try {
    if (!Auth.isAccountLoggedIn() && !login) return;
    Log.trace("refresh user profile");
    const account = await API.User.userAccount();
    const detail = await API.User.userDetail(account.profile.userId);

    const { UpdateUserProfile } = getUserStoreSnapshot();
    UpdateUserProfile(detail.profile, "account");
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/common.ts:refreshUserProfile",
        message: "refresh user profile failed",
        raw: err
      })
    );
  }
}
/** 登录状态下，只包含歌单的id、描述、封面 */
export async function refreshUserPlaylist(login: boolean = false) {
  try {
    if (!Auth.isAccountLoggedIn() && !login) return;
    Log.trace("refresh user playlist");

    const { UserProfile, UpdateUserLikedListSummary, UpdateUserPlaylistSummary } =
      getUserStoreSnapshot();
    const uid = UserProfile?.userId;
    if (uid) {
      const { playlist } = await API.User.userPlaylist({ uid, limit: 30 });
      const userLikedList = playlist.shift();
      UpdateUserLikedListSummary(userLikedList || null);
      UpdateUserPlaylistSummary(playlist);
    }
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/common.ts:refreshUserPlaylist",
        message: "refresh user playlist failed",
        raw: err
      })
    );
  }
}
/** 登录状态下，获取喜欢歌曲列表，在使用喜欢或不喜欢后应该刷新 */
export async function refreshUserLikedTrackIDs() {
  try {
    if (!Auth.isAccountLoggedIn()) return;
    Log.trace("refresh user liked track IDs");
    const { UserProfile, UpdateUserLikedTrackIDs } = getUserStoreSnapshot();
    const uid = UserProfile?.userId;
    if (uid) {
      const { ids, checkPoint, code } = await API.User.userLikedSongsIDs(uid);
      if (code === 200) {
        const idsSet: Record<number, boolean> = {};
        ids.forEach((id) => (idsSet[id] = true));
        UpdateUserLikedTrackIDs({ ids: idsSet, checkPoint });
      } else {
        Log.error(
          new EqError({
            label: "ui/common.ts:refreshUserLikedTrackIDs",
            message: `refresh user liked track IDs failed with code ${code}`
          })
        );
      }
    }
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/common.ts:refreshUserLikedTrackIDs",
        message: "refresh user liked track IDs failed",
        raw: err
      })
    );
  }
}
