import { Log } from "@/common/lib/log";
import { NeteaseUser, type NeteaseUserModel } from "@/common/netease/models";
import { userStoreSnapshot } from "@/common/store/user";
import { NeteaseServicesUser } from "@/common/netease/services/index";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPIAuth } from "@/common/netease/api";
import AppToast from "@/common/components/display/toast";

export const enum Status {
  Ok,
  Expired,
  NetErr
}

export const enum SetupStatus {
  Ok,
  Expired,
  NetErr,
  NotLogin,
  Unknown
}

function mapStatus(status: Status): SetupStatus {
  switch (status) {
    case Status.Expired:
      return SetupStatus.Expired;
    case Status.NetErr:
      return SetupStatus.NetErr;
    case Status.Ok:
      return SetupStatus.Ok;
  }
}

export default class _NeteaseAuth {
  private static get userStore() {
    return userStoreSnapshot();
  }

  static get isLoggedIn() {
    return NeteaseUser.isLoggedIn;
  }

  static async createLoginWindow() {
    RendererWindow.current.focus();
    const loginWindow = RendererWindow.get("login");
    if (!NeteaseUser.isLoggedIn) {
      loginWindow.removeMessageHandler("login");
      await loginWindow.reactReadyAwait();
      loginWindow.focus();
      loginWindow.listenMessage(
        "message_dispatch_login",
        (cookies) => {
          _NeteaseAuth.login(cookies).then((status) => {
            if (status === Status.Expired) {
              Log.error("login failed, maybe cookies invalid");
              AppToast.show({
                type: "error",
                text: "登录失败，请重试"
              });
            } else if (status === Status.NetErr) {
              AppToast.show({
                type: "error",
                text: "网络错误，请检查网络"
              });
            }
          });
        },
        { once: true, id: "login" }
      );
    }
  }

  static ensureUpdateUser(user: Nullable<NeteaseUser>) {
    if (!user) {
      throw new Error("user info empty");
    }
    _NeteaseAuth.userStore.updateUser(user);
  }

  /** 不传cookie时会检测 localStorage，仍然没有就返回null */
  static login(cookies: Optional<string>): Promise<Status> {
    return NeteaseServicesUser.cookies(cookies)
      .then(_NeteaseAuth.ensureUpdateUser)
      .then(() => Status.Ok)
      .catch(async () => {
        const status = await this.checkLoggedIn();
        // 没有获取到用户信息，但是确实已经登录的状态 => 获取用户信息时网络不稳定
        if (status === Status.Ok) {
          return Status.NetErr;
        } else {
          return status;
        }
      });
  }

  static refresh(user: NeteaseUser | NeteaseUserModel): Promise<Status> {
    return NeteaseServicesUser.refresh(user)
      .then(_NeteaseAuth.ensureUpdateUser)
      .then(() => Status.Ok)
      .catch(async () => {
        const status = await this.checkLoggedIn();
        // 没有获取到用户信息，但是确实已经登录的状态 => 获取用户信息时网络不稳定
        if (status === Status.Ok) {
          return Status.NetErr;
        } else {
          return status;
        }
      });
  }

  static logout() {
    return NeteaseServicesUser.logout().then(() => {
      _NeteaseAuth.userStore.updateUser(null);
    });
  }

  static hasSetup = false;

  static setup(): Promise<SetupStatus> {
    if (this.hasSetup) return Promise.resolve(SetupStatus.Ok);
    if (!NeteaseUser.isLoggedIn) return Promise.resolve(SetupStatus.NotLogin);
    const user = _NeteaseAuth.userStore._user;
    if (user) {
      return _NeteaseAuth
        .refresh(user)
        .then((status) => {
          if (status === Status.Ok) {
            _NeteaseAuth.hasSetup = true;
          }
          return status;
        })
        .then(mapStatus)
        .catch(() => SetupStatus.Unknown);
    } else {
      return _NeteaseAuth
        .login(null)
        .then((status) => {
          if (status === Status.Ok) {
            _NeteaseAuth.hasSetup = true;
          }
          return status;
        })
        .then(mapStatus)
        .catch(() => SetupStatus.Unknown);
    }
  }

  static checkLoggedIn(): Promise<Status> {
    return NeteaseAPIAuth.status()
      .then((res) => (res.code === 200 ? Status.Ok : Status.Expired))
      .catch(() => Status.NetErr);
  }
}
