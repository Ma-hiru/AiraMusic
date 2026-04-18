import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseUser, NeteaseUserModel } from "@mahiru/ui/public/source/netease/models";
import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import HTTPConstants from "@mahiru/ui/public/constants/http";
import AppToast from "@mahiru/ui/public/components/toast";

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
    return NeteaseServices.User.cookies(cookies).then(_NeteaseAuth.update);
  }

  static get isLoggedIn() {
    return NeteaseUser.isLoggedIn;
  }

  static createLoginWindow() {
    const loginWindow = ElectronServices.Window.from("login");
    if (!NeteaseUser.isLoggedIn) {
      loginWindow.removeMessageHandler("login");
      loginWindow.openThen(() => {
        loginWindow.listenMessage(
          "login",
          (cookies) => {
            _NeteaseAuth.login(cookies).catch(() => {
              Log.error("login failed, maybe cookies invalid");
              AppToast.request({
                type: "error",
                text: "登录失败，请重试"
              });
            });
          },
          { once: true, id: "login" }
        );
      });
    }
  }

  static refresh(user: NeteaseUser | NeteaseUserModel) {
    return NeteaseServices.User.refresh(user.profile).then(_NeteaseAuth.update);
  }

  static logout() {
    return NeteaseServices.User.logout().then(() => {
      _NeteaseAuth.userStore.updateUser(null);
      window.location.pathname = "/";
    });
  }

  static hasSetup = false;
  private static retryCount = 0;
  private static retryLimit = 15;
  private static retryEnabled = false;
  private static retryTimer: Nullable<number> = null;

  static retrySetup() {
    if (_NeteaseAuth.hasSetup) return;
    if (_NeteaseAuth.retryEnabled) return;

    _NeteaseAuth.retryEnabled = true;

    const endRetry = () => {
      _NeteaseAuth.retryEnabled = false;
      ElectronServices.Net.offOnlineChange("setup_user");
      _NeteaseAuth.retryTimer && window.clearInterval(_NeteaseAuth.retryTimer);
    };
    const doTrySetup = () => {
      if (_NeteaseAuth.hasSetup || !_NeteaseAuth.retryEnabled) return endRetry();
      _NeteaseAuth
        .setup()
        .then(() => (_NeteaseAuth.hasSetup = true))
        .then(() => endRetry())
        .catch((err) => {
          Log.error(err);
          _NeteaseAuth.retryCount++;
          if (_NeteaseAuth.retryCount >= _NeteaseAuth.retryLimit) {
            Log.error(`Failed to setup user after ${_NeteaseAuth.retryLimit} attempts, giving up`);
            endRetry();
          }
        });
    };

    if (!ElectronServices.Net.isOnline) {
      ElectronServices.Net.onOnlineChange(doTrySetup, { id: "setup_user" });
    } else {
      _NeteaseAuth.retryTimer && window.clearInterval(_NeteaseAuth.retryTimer);
      _NeteaseAuth.retryTimer = window.setInterval(doTrySetup, HTTPConstants.Timeout);
    }
  }

  static setup() {
    if (_NeteaseAuth.hasSetup) return Promise.resolve();
    else if (!NeteaseUser.isLoggedIn) {
      _NeteaseAuth.hasSetup = true;
      _NeteaseAuth.createLoginWindow();
      return Promise.resolve();
    } else if (!ElectronServices.Net.isOnline) {
      AppToast.request({
        type: "error",
        text: "当前无网络连接，无法获取用户信息，请检查网络连接"
      });
      _NeteaseAuth.retrySetup();
      return Promise.resolve();
    }

    const user = _NeteaseAuth.userStore._user;
    if (user) {
      return _NeteaseAuth
        .refresh(user)
        .then(() => {
          _NeteaseAuth.hasSetup = true;
        })
        .catch((err) => {
          AppToast.request({
            type: "error",
            text: "获取用户信息失败，请检查网络连接或重新登录"
          });
          Log.error({
            message: "fetch user info failed",
            raw: err,
            label: "NeteaseAuth"
          });
          _NeteaseAuth.hasSetup = false;
          _NeteaseAuth.retrySetup();
        });
    } else {
      return _NeteaseAuth
        .login(null)
        .then(() => {
          _NeteaseAuth.hasSetup = true;
        })
        .catch((err) => {
          AppToast.request({
            type: "error",
            text: "获取用户信息失败，请检查网络连接或重新登录"
          });
          Log.error({
            message: "fetch user info failed",
            raw: err,
            label: "NeteaseAuth"
          });
          _NeteaseAuth.hasSetup = false;
          _NeteaseAuth.retrySetup();
        });
    }
  }
}
