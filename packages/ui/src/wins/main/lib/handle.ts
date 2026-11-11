import { Log } from "@/common/lib/log";
import { useListenable } from "@/common/hooks/use-listenable";
import RendererPlayer from "@/common/player/core";

import { RendererPlayerStorage } from "./player-storage";

const savedPlayer = await RendererPlayerStorage.load<
  ReturnType<typeof RendererPlayer.save>
>().catch((error: unknown) => {
  Log.error("读取播放状态失败", error);
  return undefined;
});

export default class RendererPlayerHandle {
  //region inner
  private static _player: Nullable<RendererPlayer>;

  private static async savePlayer() {
    if (!this._player) return;
    this._player.audio.pause();
    await RendererPlayerStorage.save(RendererPlayer.save(this._player));
  }

  private static loadPlayer() {
    if (this._player) return this._player;
    if (savedPlayer) return RendererPlayer.fromSave(savedPlayer);
    return null;
  }

  private static setupPlayer() {
    this._player = this.loadPlayer() ?? new RendererPlayer();
    return this;
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

  static async [Symbol.asyncDispose]() {
    await this.savePlayer();
  }

  static {
    this.setupPlayer();
  }
}

function usePlayer() {
  return useListenable(RendererPlayerHandle.player);
}
