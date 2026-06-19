import { Log } from "@/common/lib/log";
import { NeteaseUser, type NeteaseUserModel } from "@/common/netease/models";
import { userStoreSnapshot } from "@/common/store/user";
import { NeteaseServicesUser } from "@/common/netease/services/index";
import { RendererWindow } from "@/common/lib/window";
import AppToast from "@/common/components/display/toast";

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
    return NeteaseServicesUser.cookies(cookies).then(_NeteaseAuth.update);
  }

  static get isLoggedIn() {
    return NeteaseUser.isLoggedIn;
  }

  static async createLoginWindow() {
    const loginWindow = RendererWindow.get("login");
    if (!NeteaseUser.isLoggedIn) {
      loginWindow.removeMessageHandler("login");
      await loginWindow.reactReadyAwait();
      loginWindow.listenMessage(
        "message_dispatch_login",
        (cookies) => {
          _NeteaseAuth.login(cookies).catch(() => {
            Log.error("login failed, maybe cookies invalid");
            AppToast.show({
              type: "error",
              text: "登录失败，请重试"
            });
          });
        },
        { once: true, id: "login" }
      );
    }
  }

  static refresh(user: NeteaseUser | NeteaseUserModel) {
    return NeteaseServicesUser.refresh(user.profile).then(_NeteaseAuth.update);
  }

  static logout() {
    return NeteaseServicesUser.logout().then(() => {
      _NeteaseAuth.userStore.updateUser(null);
    });
  }

  static hasSetup = false;

  static setup() {
    if (this.hasSetup) return Promise.resolve(true);
    if (!NeteaseUser.isLoggedIn) return Promise.resolve(false);
    const user = _NeteaseAuth.userStore._user;
    if (user) {
      return _NeteaseAuth.refresh(user).then(() => {
        _NeteaseAuth.hasSetup = true;
        return true;
      });
    } else {
      return _NeteaseAuth.login(null).then(() => {
        _NeteaseAuth.hasSetup = true;
        return true;
      });
    }
  }
}
