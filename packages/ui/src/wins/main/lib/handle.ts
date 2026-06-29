import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererOnce } from "@/common/lib/once";
import { RendererCache } from "@/common/lib/cache";
import RendererPlayer from "@/common/player/core";

export default class RendererPlayerHandle {
  //region inner
  private static _player: Nullable<RendererPlayer>;

  private static savePlayer() {
    if (!this._player) return;
    this._player.audio.pause();
    RendererCache.browser.setOne("app_player", RendererPlayer.save(this._player));
  }

  private static loadPlayer() {
    if (this._player) return this._player;
    const data = RendererCache.browser.getOne<ReturnType<typeof RendererPlayer.save>>("app_player");
    if (data) return RendererPlayer.fromSave(data);
    return null;
  }

  private static setupPlayer() {
    this._player = this.loadPlayer() ?? new RendererPlayer();
    return this;
  }

  private static setupMini() {
    RendererOnce.do("setupMini", async () => {
      const miniWindow = RendererWindow.get("miniplayer");
      await miniWindow.reactReadyAwait();
    });
  }
  //endregion

  static get player() {
    if (!this._player) this.setupPlayer();
    return this._player!;
  }

  static get usePlayer() {
    if (!this._player) this.setupPlayer();
    return usePlayer;
  }

  static [Symbol.dispose]() {
    this.savePlayer();
  }

  static {
    this.setupPlayer().setupMini();
  }
}

function usePlayer() {
  return useListenable(RendererPlayerHandle.player);
}
