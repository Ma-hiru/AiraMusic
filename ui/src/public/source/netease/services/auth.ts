import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseUser, NeteaseUserModel } from "@mahiru/ui/public/source/netease/models";
import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

export default class _NeteaseAuth {
  private static get userStore() {
    return userStoreSnapshot();
  }

  private static update(user: Nullable<NeteaseUser>) {
    if (!user) {
      Log.error("fetch user info failed, maybe cookies expired");
      void _NeteaseAuth.logout();
    }
    _NeteaseAuth.userStore.updateUser(user);
  }

  static login(cookies: Optional<string>) {
    return NeteaseServices.User.cookies(cookies)
      .then(_NeteaseAuth.update)
      .catch((err) => {
        Log.error(`fetch user info failed: ${err}`);
      });
  }

  static get isLoggedIn() {
    return NeteaseUser.isLoggedIn;
  }

  static createLoginWindow() {
    const loginWindow = ElectronServices.Window.from("login");
    if (!NeteaseUser.isLoggedIn) {
      loginWindow.openThen(() => {
        loginWindow.listen("login", _NeteaseAuth.login, { once: true, id: "login" });
      });
    }
  }

  static refresh(user: NeteaseUser | NeteaseUserModel) {
    return NeteaseServices.User.refresh(user.profile)
      .then(_NeteaseAuth.update)
      .catch((err) => {
        Log.error(`fetch user info failed: ${err}`);
      });
  }

  static logout() {
    return NeteaseServices.User.logout().then(() => {
      _NeteaseAuth.userStore.updateUser(null);
      window.location.pathname = "/";
    });
  }

  static setup() {
    if (!NeteaseUser.isLoggedIn) return Promise.resolve();
    const user = _NeteaseAuth.userStore._user;
    if (user) {
      return _NeteaseAuth.refresh(user);
    } else {
      return _NeteaseAuth.login(null);
    }
  }
}
