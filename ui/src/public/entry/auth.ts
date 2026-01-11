import Cookies from "js-cookie";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";
import { API } from "@mahiru/ui/public/api";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

@AddLocalStore
export class AuthClass {
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
    const loginMode = this.localSnapshot.User.UserLoginMode;
    return this.getCookie("MUSIC_U") !== undefined && loginMode === "account";
  };

  /** 用户名搜索（用户数据为只读） */
  isUsernameLoggedIn = () => {
    const loginMode = this.localSnapshot.User.UserLoginMode;
    return loginMode === "username";
  };

  /** 账户登录或者用户名搜索都判断为登录，宽松检查 */
  isLooseLoggedIn = () => {
    return this.isAccountLoggedIn() || this.isUsernameLoggedIn();
  };

  private subscriber = new Set<NormalFunc<[login: boolean]>>();

  private execSubscriber = (login: boolean) => {
    this.subscriber.forEach((cb) => {
      try {
        cb(login);
      } catch (err) {
        Log.error(
          new EqError({ raw: err, message: "auth subscriber exec error", label: "auth.ts" })
        );
        this.subscriber.delete(cb);
      }
    });
  };

  subscribeLoginChange = (cb: NormalFunc<[login: boolean]>) => {
    this.subscriber.add(cb);
    return () => {
      this.subscriber.delete(cb);
    };
  };

  refreshProfile = async () => {
    if (!this.isAccountLoggedIn()) return;
    Log.trace("refresh user profile");
    const account = await API.User.userAccount();
    const detail = await API.User.userDetail(account.profile.userId);
    const { ids, checkPoint } = await API.User.userLikedSongsIDs(account.profile.userId);
    const idsSet: Record<number, boolean> = {};
    ids.forEach((id) => (idsSet[id] = true));
    this.localProxy.User.UserLikedTrackIDs = { ids: idsSet, checkPoint };
    this.localProxy.User.UserProfile = detail.profile;
  };

  refreshCookies = async () => {
    if (!this.isAccountLoggedIn()) return;
    Log.trace("refresh user profile");
    await API.Auth.refreshCookie();
    this.localProxy.User.LastRefreshCookiesDay = new Date().getDate();
  };

  doLogin = (cookies: string) => {
    Log.trace("doLogin");
    this.localProxy.User.UserLoginMode = "account";
    this.localProxy.User.LastRefreshCookiesDay = new Date().getDate();
    this.setCookies(cookies);
    void this.refreshProfile();
    requestIdleCallback(() => this.execSubscriber(true), { timeout: 1000 });
  };

  doLogout = () => {
    return API.Auth.logout().finally(() => {
      this.removeCookie("MUSIC_U");
      this.removeCookie("__csrf");
      this.localProxy.User.UserLoginMode = null;
      this.localProxy.User.UserProfile = null;
      this.localProxy.User.UserLikedTrackIDs = { ids: {}, checkPoint: 0 };
      requestIdleCallback(() => this.execSubscriber(false), { timeout: 1000 });
    });
  };
}

export interface AuthClass extends WithLocalStore {}

export const Auth = new AuthClass();
