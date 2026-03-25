import NeteaseSource from "@mahiru/ui/public/entry/source";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseUser, NeteaseUserModel } from "@mahiru/ui/public/models/netease";
import { userStoreSnapshot } from "@mahiru/ui/public/store/user";

export default class AppAuth {
  private static get userStore() {
    return userStoreSnapshot();
  }

  private static update(user: Nullable<NeteaseUser>) {
    if (!user) {
      Log.error("fetch user info failed, maybe cookies expired");
      void AppAuth.logout();
    }
    AppAuth.userStore.updateUser(user);
  }

  static login(cookies: Optional<string>) {
    return NeteaseSource.User.fromCookies(cookies)
      .then(AppAuth.update)
      .catch((err) => {
        Log.error(`fetch user info failed: ${err}`);
      });
  }

  static refresh(user: NeteaseUser | NeteaseUserModel) {
    return NeteaseSource.User.refresh(user.profile)
      .then(AppAuth.update)
      .catch((err) => {
        Log.error(`fetch user info failed: ${err}`);
      });
  }

  static logout() {
    return NeteaseSource.User.logout().then(() => {
      AppAuth.userStore.updateUser(null);
    });
  }

  static setup() {
    if (!NeteaseUser.isLoggedIn) return Promise.resolve();
    const user = AppAuth.userStore._user;
    if (user) {
      return AppAuth.refresh(user);
    } else {
      return AppAuth.login(null);
    }
  }
}
