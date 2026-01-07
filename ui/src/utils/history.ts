import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";
import { setCloseTask } from "@mahiru/ui/utils/close";

export type HistoryEntry = {
  track: NeteaseTrack;
  recordTime: number;
  playDuration: number;
};

@AddStoreSnapshot
class PlayerHistoryClass {
  private maxSize = 500;
  private outerUpdater: Set<NormalFunc> = new Set();
  private history: HistoryEntry[] = [];

  private execOuterUpdater() {
    for (const updater of this.outerUpdater) {
      try {
        updater();
      } catch {
        this.removeOuterUpdater(updater);
      }
    }
  }

  private createEntry(track: NeteaseTrack, duration: number) {
    const newTrack = {
      ...track,
      playDuration: duration,
      recordTime: Date.now()
    };

    return {
      track: newTrack,
      recordTime: newTrack.recordTime,
      playDuration: newTrack.playDuration
    } satisfies HistoryEntry;
  }

  private Save() {
    this.playerSnapshot.SetPlayerHistory(this.history);
  }

  Sync() {
    setCloseTask("save_player_history", async () => this.Save());
    this.history = structuredClone(this.playerSnapshot.PlayerHistory);
  }

  addOuterUpdater(updater: NormalFunc) {
    this.outerUpdater.add(updater);
  }

  removeOuterUpdater(updater: NormalFunc) {
    this.outerUpdater.delete(updater);
  }

  findTrack(id: number) {
    const idx = this.history.findIndex((h) => h.track.id === id);
    if (idx >= 0) {
      return { track: this.history[idx]!, idx };
    } else {
      return { track: null, idx: -1 } as const;
    }
  }

  addTrack(track: NeteaseTrack, duration: number) {
    const findResult = this.findTrack(track.id);
    if (findResult.track) {
      this.history.splice(findResult.idx, 1);
    }
    this.history.unshift(this.createEntry(track, duration));
    this.limitSize();
    this.execOuterUpdater();
  }

  removeTrack(id: number) {
    const findResult = this.findTrack(id);
    if (findResult.track) {
      this.history.splice(findResult.idx, 1);
    }
    this.execOuterUpdater();
  }

  clear() {
    this.history = [];
    this.execOuterUpdater();
  }

  get current() {
    return this.history;
  }

  get count() {
    return this.history.length;
  }

  get tracks() {
    return this.current.map((entry) => entry.track);
  }

  limitSize() {
    // 超出限制
    if (this.count > this.maxSize) {
      // 已经是按照时间排序，最新添加的歌曲在队首
      this.history.length = this.maxSize;
    }
  }
}
interface PlayerHistoryClass extends WithStoreSnapshot {}

export const PlayerHistory = new PlayerHistoryClass();

requestIdleCallback(() => {
  PlayerHistory.Sync();
});
