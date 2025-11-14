import Cookies from "js-cookie";
import { logout } from "../auth";
import { usePersistZustandStore } from "@mahiru/ui/store";

export function setCookies(raw: string) {
  const cookies = raw.split(";;");
  cookies.map((cookie) => {
    document.cookie = cookie;
    const cookieKeyValue = cookie.split(";")[0]?.split("=");
    if (cookieKeyValue && typeof cookieKeyValue[1] !== "undefined") {
      localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1]);
    }
  });
}

export function getCookie(key: string) {
  return Cookies.get(key) ?? localStorage.getItem(`cookie-${key}`);
}

export function removeCookie(key: string) {
  Cookies.remove(key);
  localStorage.removeItem(`cookie-${key}`);
}

/** MUSIC_U 只有在账户登录的情况下才有 */
export function isLoggedIn() {
  return getCookie("MUSIC_U") !== undefined;
}

// 账号登录
export function isAccountLoggedIn() {
  const loginMode = usePersistZustandStore.getState().data.loginMode;
  return getCookie("MUSIC_U") !== undefined && loginMode === "account";
}

/** 用户名搜索（用户数据为只读） */
export function isUsernameLoggedIn() {
  const loginMode = usePersistZustandStore.getState().data.loginMode;
  return loginMode === "username";
}

/** 账户登录或者用户名搜索都判断为登录，宽松检查 */
export function isLooseLoggedIn() {
  return isAccountLoggedIn() || isUsernameLoggedIn();
}

const { updatePersistStoreData } = usePersistZustandStore.getState();
export function doLogout() {
  logout();
  removeCookie("MUSIC_U");
  removeCookie("__csrf");
  // 更新状态仓库中的用户信息
  updatePersistStoreData({ user: {} });
  // 更新状态仓库中的登录状态
  updatePersistStoreData({ loginMode: null });
  // 更新状态仓库中的喜欢列表
  updatePersistStoreData({ likedSongPlaylistID: undefined });
}
