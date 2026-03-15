import Cookies from "js-cookie";
import NCM_API from "@mahiru/ui/public/api";

export class NeteaseCookie {
  static set(raw: string) {
    const cookies = raw.split(";;");
    cookies.map((cookie) => {
      document.cookie = cookie;
      const cookieKeyValue = cookie.split(";")[0]?.split("=");
      if (cookieKeyValue && typeof cookieKeyValue[1] !== "undefined") {
        localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1]);
      }
    });
  }

  static get(key: string) {
    return Cookies.get(key) || localStorage.getItem(`cookie-${key}`);
  }

  static remove(key: string) {
    Cookies.remove(key);
    localStorage.removeItem(`cookie-${key}`);
  }

  /** MUSIC_U 只有在账户登录的情况下才有 */
  static isLoggedIn() {
    return !!NeteaseCookie.get("MUSIC_U");
  }

  static clearLoggedIn() {
    NeteaseCookie.remove("MUSIC_U");
    NeteaseCookie.remove("__csrf");
  }

  static async refresh() {
    if (!NeteaseCookie.isLoggedIn()) return false;
    return NCM_API.Auth.refreshCookie()
      .then(() => true)
      .catch(() => false);
  }
}
