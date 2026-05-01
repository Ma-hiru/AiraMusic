import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import AppPlayer from "@mahiru/ui/public/player/core";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

export default class AppEntry {
  //region inner
  private static _player: Nullable<AppPlayer>;
  private static _usePlayer: Nullable<() => AppPlayer>;
  private static _innerUpdater = new Map<string, NormalFunc>();
  private static get userStore() {
    return userStoreSnapshot();
  }

  private static createAppPlayerHook(instance: Optional<AppPlayer>) {
    const player = instance ?? new AppPlayer();

    function useAppPlayer() {
      return useListenableHook(player);
    }

    return {
      player,
      useAppPlayer
    };
  }

  private static savePlayer() {
    if (!this._player) return;
    this.player.audio.pause();
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
    const { player, useAppPlayer } = this.createAppPlayerHook(this.loadPlayer());
    this._player = player;
    this._usePlayer = useAppPlayer;
    return this;
  }

  private static setupUser() {
    void NeteaseServices.Auth.setup();
    return this;
  }

  private static setupMini() {
    ElectronServices.Once.do("setupMini", () => {
      const miniWindow = ElectronServices.Window.from("miniplayer");
      setTimeout(async () => {
        if (!miniWindow.opened) {
          await miniWindow.openAwait();
          AppEntry.busUpdater?.();
        }
      }, 7000);
    });
  }
  //endregion

  static _init() {
    this.setupUser().setupPlayer().setupMini();
  }

  static get player() {
    if (!this._player) this.setupPlayer();
    return this._player!;
  }

  static get usePlayer() {
    if (!this._usePlayer) this.setupPlayer();
    return this._usePlayer!;
  }

  static dispose() {
    this.savePlayer();
  }

  static registerInnerUpdater(id: string, updater: NormalFunc) {
    AppEntry._innerUpdater.set(id, updater);
    return () => {
      AppEntry._innerUpdater.delete(id);
    };
  }

  static getInnerUpdater(id: string) {
    return AppEntry._innerUpdater.get(id);
  }

  static get busUpdater() {
    return AppEntry.getInnerUpdater("main-bus");
  }

  static set busUpdater(fn: Undefinable<NormalFunc>) {
    if (!fn) return;
    AppEntry.registerInnerUpdater("main-bus", fn);
  }
}
