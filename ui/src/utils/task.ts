import { EqError, Log } from "@mahiru/ui/utils/dev";
import { refreshCookie } from "@mahiru/ui/api/auth";
import { userAccount, userDetail, userLikedSongsIDs, userPlaylist } from "@mahiru/ui/api/user";
import { getDynamicSnapshot, getPersistSnapshot } from "@mahiru/ui/store";
import { doLogout, setCookies } from "@mahiru/ui/utils/auth";

/** 登录接口 */
export async function refreshLogin(cookies: string) {
  Log.debug("Logged in successfully, fetching user data...");
  try {
    setCookies(cookies);
    await refreshUserProfile();
    await refreshUserPlaylist();
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/utils/login.ts",
        message: "Failed to fetch user data after login.",
        raw: err
      })
    );
    doLogout();
  }
}
/** 登录状态下，刷新Cookie */
export async function refreshCookieTask() {
  try {
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
export async function refreshUserProfile() {
  try {
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
export async function refreshUserPlaylist() {
  try {
    Log.trace("refresh user playlist");
    const { updateUserLikedPlayList, getUserPlayListSummaryStatic, staticUpdateTrigger } =
      getDynamicSnapshot();
    const { data } = getPersistSnapshot();
    const uid = data.user?.userId;
    if (uid) {
      const { playlist } = await userPlaylist({ uid, limit: 30 });
      const userLikedList = playlist.shift();
      updateUserLikedPlayList(userLikedList || null);
      const userPlaylistStatic = getUserPlayListSummaryStatic();
      userPlaylistStatic.length = 0;
      userPlaylistStatic.push(...playlist);
    }
    staticUpdateTrigger();
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
    Log.trace("refresh user liked track IDs");
    const { updateLikedTrackIDs } = getDynamicSnapshot();
    const { data } = getPersistSnapshot();
    const uid = data.user?.userId;
    if (uid) {
      const { ids, checkPoint, code } = await userLikedSongsIDs(uid);
      if (code === 200) {
        updateLikedTrackIDs(new Set<number>(ids), checkPoint);
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
/** 从持久化存储加载播放历史列表到静态列表 */
export async function loadHistoryListFromPersistentStore() {
  const { data, getHistoryListStatic } = getPersistSnapshot();
  const persistedHistoryList = data._historyList || [];
  const historyListStatic = getHistoryListStatic();
  historyListStatic.length = 0;
  historyListStatic.push(...persistedHistoryList);
  return Promise.resolve();
}
