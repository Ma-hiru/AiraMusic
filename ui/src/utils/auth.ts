import Cookies from "js-cookie";
import { router } from "@mahiru/ui/router";
import { API } from "@mahiru/ui/api";
import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";

@AddStoreSnapshot
class AuthClass {
  setCookies = (raw: string) => {
    const cookies = raw.split(";;");
    cookies.map((cookie) => {
      document.cookie = cookie;
      const cookieKeyValue = cookie.split(";")[0]?.split("=");
      if (cookieKeyValue && typeof cookieKeyValue[1] !== "undefined") {
        localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1]);
      }
    });
  };

  getCookie = (key: string) => {
    return Cookies.get(key) || localStorage.getItem(`cookie-${key}`);
  };

  removeCookie = (key: string) => {
    Cookies.remove(key);
    localStorage.removeItem(`cookie-${key}`);
  };

  /** MUSIC_U 只有在账户登录的情况下才有 */
  isLoggedIn = () => {
    return this.getCookie("MUSIC_U") !== undefined;
  };

  // 账号登录
  isAccountLoggedIn = () => {
    const loginMode = this.userSnapshot.UserLoginMode;
    return this.getCookie("MUSIC_U") !== undefined && loginMode === "account";
  };

  /** 用户名搜索（用户数据为只读） */
  isUsernameLoggedIn = () => {
    const loginMode = this.userSnapshot.UserLoginMode;
    return loginMode === "username";
  };

  /** 账户登录或者用户名搜索都判断为登录，宽松检查 */
  isLooseLoggedIn = () => {
    return this.isAccountLoggedIn() || this.isUsernameLoggedIn();
  };

  doLogout = () => {
    return API.Auth.logout().finally(() => {
      this.removeCookie("MUSIC_U");
      this.removeCookie("__csrf");
      // 更新状态仓库

      const {
        UpdateUserLastRefreshCookieDate,
        UpdateUserProfile,
        UpdateUserLikedTrackIDs,
        UpdateUserLikedListSummary,
        UpdateUserPlaylistSummary
      } = this.userSnapshot;

      UpdateUserLastRefreshCookieDate(null);
      UpdateUserProfile(null, "");
      UpdateUserLikedTrackIDs({ ids: {}, checkPoint: Date.now() });
      UpdateUserLikedListSummary(null);
      UpdateUserPlaylistSummary([]);
      return router.navigate("/home");
    });
  };
}
interface AuthClass extends WithStoreSnapshot {}

export const Auth = new AuthClass();
