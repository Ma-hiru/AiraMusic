import { EqError, Log } from "@mahiru/ui/utils/dev";
import { refreshCookie } from "@mahiru/ui/api/auth";
import { userAccount, userDetail, userLikedSongsIDs, userPlaylist } from "@mahiru/ui/api/user";
import { getPersistSnapshot } from "@mahiru/ui/store";
import { Auth } from "@mahiru/ui/utils/auth";

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
    await refreshCookie();

    const store = getPersistSnapshot();
    store.updatePersistStoreData({
      lastRefreshCookieDate: new Date().getDate()
    });
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
    const account = await userAccount();
    const detail = await userDetail(account.profile.userId);

    const { updatePersistStoreData } = getPersistSnapshot();
    updatePersistStoreData({
      loginMode: "account",
      user: detail.profile
    });
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
    const { updateUserLikedListSummary, updateUserPlaylistSummary } = getPersistSnapshot();
    const { data } = getPersistSnapshot();
    const uid = data.user?.userId;
    if (uid) {
      const { playlist } = await userPlaylist({ uid, limit: 30 });
      const userLikedList = playlist.shift();
      updateUserLikedListSummary(userLikedList || null);
      updateUserPlaylistSummary(playlist);
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
    const { updateUserLikedTrackIDs } = getPersistSnapshot();
    const { data } = getPersistSnapshot();
    const uid = data.user?.userId;
    if (uid) {
      const { ids, checkPoint, code } = await userLikedSongsIDs(uid);
      if (code === 200) {
        const idsSet: Record<number, boolean> = {};
        ids.forEach((id) => (idsSet[id] = true));
        updateUserLikedTrackIDs({ ids: idsSet, checkPoint });
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
