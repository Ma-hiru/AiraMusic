import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseUser, NeteaseUserModel } from "@mahiru/ui/public/source/netease/models";
import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

export default class NeteaseAuth {
  private static get userStore() {
    return userStoreSnapshot();
  }

  private static update(user: Nullable<NeteaseUser>) {
    if (!user) {
      Log.error("fetch user info failed, maybe cookies expired");
      void NeteaseAuth.logout();
    }
    NeteaseAuth.userStore.updateUser(user);
  }

  static login(cookies: Optional<string>) {
    return NeteaseServices.User.cookies(cookies)
      .then(NeteaseAuth.update)
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
        loginWindow.listen("login", NeteaseAuth.login, { once: true, id: "login" });
      });
    }
  }

  static refresh(user: NeteaseUser | NeteaseUserModel) {
    return NeteaseServices.User.refresh(user.profile)
      .then(NeteaseAuth.update)
      .catch((err) => {
        Log.error(`fetch user info failed: ${err}`);
      });
  }

  static logout() {
    return NeteaseServices.User.logout().then(() => {
      NeteaseAuth.userStore.updateUser(null);
      window.location.pathname = "/";
    });
  }

  static setup() {
    if (!NeteaseUser.isLoggedIn) return Promise.resolve();
    const user = NeteaseAuth.userStore._user;
    if (user) {
      return NeteaseAuth.refresh(user);
    } else {
      return NeteaseAuth.login(null);
    }
  }
}
