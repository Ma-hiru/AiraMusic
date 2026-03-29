import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import AppPlayer from "@mahiru/ui/public/entry/player/AppPlayer";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppAuth from "@mahiru/ui/public/entry/auth";

export default class AppInstance {
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
    void AppAuth.setup();
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
    return CacheStore.dispose();
  }
}
