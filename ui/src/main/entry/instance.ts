import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";
import AppPlayer, { createAppPlayerHook } from "@mahiru/ui/public/models/player/AppPlayer";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

export default class AppInstance {
  private static _player: Nullable<AppPlayer>;
  private static _usePlayer: Nullable<() => AppPlayer>;
  private static get userStore() {
    return userStoreSnapshot();
  }

  private static savePlayer() {
    if (!this._player) return;
    const data = JSON.stringify(AppPlayer.save(this._player));
    localStorage.setItem("app_player", data);
  }

  private static loadPlayer() {
    if (this._player) return this._player;
    const data = localStorage.getItem("app_player");
    if (data) return AppPlayer.fromSave(JSON.parse(data));
    return null;
  }

  private static setupPlayer() {
    const { player, useAppPlayer } = createAppPlayerHook(this.loadPlayer());
    this._player = player;
    this._usePlayer = useAppPlayer;
    return this;
  }

  private static setupUser() {
    if (!NeteaseUser.isLoggedIn) return this;

    const refresh = (user: Optional<NeteaseUser>) => {
      if (user) {
        this.userStore.updateUser(user);
      } else {
        Log.error("fetch user info failed, maybe cookies expired");
        void NeteaseSource.User.logout();
      }
    };

    const user = this.userStore._user;
    if (user) {
      NeteaseSource.User.refresh(user.profile)
        .then(refresh)
        .catch((err) => {
          Log.error(`fetch user info failed: ${err}`);
        });
    } else {
      NeteaseSource.User.fromCookies()
        .then(refresh)
        .catch((err) => {
          Log.error(`fetch user info failed: ${err}`);
        });
    }

    return this;
  }

  static get player() {
    if (!this._player) this.setupPlayer();
    return this._player!;
  }

  static get usePlayer() {
    if (!this._usePlayer) this.setupPlayer();
    return this._usePlayer!;
  }

  static get renderer() {
    return AppRenderer;
  }

  static init() {
    this.setupUser().setupPlayer();
  }

  static dispose() {
    this.savePlayer();
  }
}
