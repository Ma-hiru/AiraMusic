import { Log } from "@mahiru/ui/utils/log";
import { refreshCookie } from "@mahiru/ui/api/auth";
import { EqError } from "@mahiru/ui/utils/err";
import { userAccount, userDetail, userPlaylist } from "@mahiru/ui/api/user";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { doLogout, setCookies } from "@mahiru/ui/api/utils/auth";
import { initLikedSongsSearcher } from "@mahiru/ui/utils/song";

const getStoreSnapshot = () => usePersistZustandStore.getState();

export async function refreshCookieTask() {
  try {
    Log.trace("refresh cookie");
    await refreshCookie();

    const store = getStoreSnapshot();
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

export async function refreshUserProfile() {
  try {
    Log.trace("refresh user profile");
    const { updatePersistStoreData } = getStoreSnapshot();
    const account = await userAccount();
    const detail = await userDetail(account.profile.userId);
    const playList = await userPlaylist({ uid: account.profile.userId, limit: 30 });
    const userLikedList = playList.playlist.shift();
    updatePersistStoreData({
      loginMode: "account",
      user: detail.profile,
      userPlayLists: playList.playlist,
      userLikedList: userLikedList || null
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

export async function refreshLogin(cookies: string) {
  Log.debug("Logged in successfully, fetching user data...");
  try {
    setCookies(cookies);
    await refreshUserProfile();
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

export async function refreshLikedListDetailString() {
  const { data, updatePersistStoreData } = getStoreSnapshot();
  if (data.userLikedList) {
    fetch(`http://127.0.0.1:10754/playlist/detail?id=${data.userLikedList.id}`)
      .then((res) => res.text())
      .then((detail) => {
        detail &&
          updatePersistStoreData({
            userLikedListDetail: detail
          });
        initLikedSongsSearcher(detail);
      });
  }
}

export async function isBackgroundDark() {}
