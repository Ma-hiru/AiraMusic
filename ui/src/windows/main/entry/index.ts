import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import AppPlayer from "@mahiru/ui/public/player/core";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import NeteaseAuth from "@mahiru/ui/public/source/netease/auth";

export default class AppEntry {
  //region inner
  private static _player: Nullable<AppPlayer>;
  private static _usePlayer: Nullable<() => AppPlayer>;
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
    void NeteaseAuth.setup();
    return this;
  }
  //endregion

  static init() {
    this.setupUser().setupPlayer();
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
}
