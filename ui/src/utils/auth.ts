import Cookies from "js-cookie";
import { router } from "@mahiru/ui/router";
import { getPersistSnapshot, usePersistZustandStore } from "@mahiru/ui/store";
import { API } from "@mahiru/ui/api";

function setCookies(raw: string) {
  const cookies = raw.split(";;");
  cookies.map((cookie) => {
    document.cookie = cookie;
    const cookieKeyValue = cookie.split(";")[0]?.split("=");
    if (cookieKeyValue && typeof cookieKeyValue[1] !== "undefined") {
      localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1]);
    }
  });
}

function getCookie(key: string) {
  return Cookies.get(key) || localStorage.getItem(`cookie-${key}`);
}

function removeCookie(key: string) {
  Cookies.remove(key);
  localStorage.removeItem(`cookie-${key}`);
}

/** MUSIC_U 只有在账户登录的情况下才有 */
function isLoggedIn() {
  return getCookie("MUSIC_U") !== undefined;
}

// 账号登录
function isAccountLoggedIn() {
  const loginMode = usePersistZustandStore.getState().data.loginMode;
  return getCookie("MUSIC_U") !== undefined && loginMode === "account";
}

/** 用户名搜索（用户数据为只读） */
function isUsernameLoggedIn() {
  const loginMode = usePersistZustandStore.getState().data.loginMode;
  return loginMode === "username";
}

/** 账户登录或者用户名搜索都判断为登录，宽松检查 */
function isLooseLoggedIn() {
  return isAccountLoggedIn() || isUsernameLoggedIn();
}

function doLogout() {
  return API.Auth.logout().finally(() => {
    removeCookie("MUSIC_U");
    removeCookie("__csrf");
    // 更新状态仓库
    const {
      updatePersistStoreData,
      updateUserLikedTrackIDs,
      updateUserPlaylistSummary,
      updateUserLikedListSummary
    } = getPersistSnapshot();

    updatePersistStoreData({
      user: null,
      loginMode: "",
      lastRefreshCookieDate: 0
    });
    updateUserLikedTrackIDs({ ids: {}, checkPoint: new Date().getTime() });
    updateUserLikedListSummary(null);
    updateUserPlaylistSummary([]);
    return router.navigate("/home");
  });
}

export const Auth = {
  setCookies,
  getCookie,
  isLoggedIn,
  isAccountLoggedIn,
  isUsernameLoggedIn,
  isLooseLoggedIn,
  doLogout
};
