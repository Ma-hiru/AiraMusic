import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererOnce } from "@/common/lib/once";
import { RendererCache } from "@/common/lib/cache";
import AppPlayer from "@/common/player/core";

export default class AppEntry {
  //region inner
  private static _player: Nullable<AppPlayer>;
  private static _usePlayer: Nullable<() => AppPlayer>;
  private static _innerUpdater = new Map<string, NormalFunc>();

  private static createAppPlayerHook(instance: Optional<AppPlayer>) {
    const player = instance ?? new AppPlayer();

    function useAppPlayer() {
      return useListenable(player);
    }

    return {
      player,
      useAppPlayer
    };
  }

  private static savePlayer() {
    if (!this._player) return;
    this._player.audio.pause();
    RendererCache.browser.setOne("app_player", AppPlayer.save(this._player));
  }

  private static loadPlayer() {
    if (this._player) return this._player;
    const data = RendererCache.browser.getOne<ReturnType<typeof AppPlayer.save>>("app_player");
    if (data) return AppPlayer.fromSave(data);
    return null;
  }

  private static setupPlayer() {
    const { player, useAppPlayer } = this.createAppPlayerHook(this.loadPlayer());
    this._player = player;
    this._usePlayer = useAppPlayer;
    return this;
  }

  private static setupMini() {
    RendererOnce.do("setupMini", () => {
      const miniWindow = RendererWindow.get("miniplayer");
      miniWindow.open();
      miniWindow.hide();
      setTimeout(async () => {
        await miniWindow.reactReadyAwait();
        AppEntry.busUpdater?.();
      }, 5000);
    });
  }
  //endregion

  static _init() {
    this.setupPlayer().setupMini();
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
