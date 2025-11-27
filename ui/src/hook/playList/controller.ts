import { RangeTree } from "@mahiru/wasm";
import { PlayListDataSource } from "@mahiru/ui/hook/playList/datasource";
import { NeteasePlaylistDetail, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { clearTimeout } from "node:timers";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

type Range = [start: number, end: number];

type Slot = {
  index: number;
  id: number;
  track?: NeteaseTrack;
  loading?: boolean;
};

export class PlayListController {
  private rangeTree = new RangeTree();
  private slots: Slot[];
  private idToIndex = new Map<number, number>();
  private urlToIndex = new Map<string, number>();
  private dataSource = new PlayListDataSource(100);
  private subscribers: Set<NormalFunc> = new Set();
  private ws?: WebSocket;
  private notifyTimer?: number;

  constructor(public playList: NeteasePlaylistDetail) {
    const total = playList.trackIds.length;
    this.slots = new Array(total);
    playList.trackIds.forEach((track, index) => {
      this.slots[index] = { index, id: track.id, track: undefined, loading: false };
      this.idToIndex.set(track.id, index);
    });
    this.initWebSocket();
  }

  private initWebSocket() {
    try {
      this.ws = new WebSocket("ws://127.0.0.1:8824/ws");
      this.ws.onmessage = (ev) => {
        const message = JSON.parse(ev.data);
        if (!message?.id || !message?.file) return;
        const idx = this.urlToIndex.get(message.id);
        if (idx) {
          const slot = this.slots[idx];
          if (slot) {
            if (slot.track) slot.track.al.picUrl = message.file;
            else {
              // 如果还未加载 track，后续 loadRange 时会 replace it
              // 但为了 completeness，我们可以 store a small placeholder
              slot.track = { al: { picUrl: message.file } } as NeteaseTrack;
            }
          }
        } else {
          // 备用：如果没有 url->index 映射，尝试遍历（只有极少情况）
          for (const slot of this.slots) {
            if (slot.track && slot.track?.al?.picUrl?.includes(message.id)) {
              slot.track.al.picUrl = message.file;
              this.notify();
              break;
            }
          }
        }
      };
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: "Failed to initialize WebSocket in PlayListController",
          label: "ui/src/hook/playList/controller.ts:initWebSocket"
        })
      );
    }
  }

  /**
   * peekPage: 立即返回当前 slots 引用快照（不会触发网络）
   * 返回的是 slot.track（可能为 undefined）的数组（引用为 slots 的子数组）
   */
  peekPage(page: number, limit: number) {
    const start = page * limit;
    const end = Math.min(start + limit, this.slots.length);
    return this.slots.slice(start, end).map((s) => s.track ?? s);
  }

  /**
   * getPage: 异步保证数据加载完毕（会触发 loadRange）
   * - 会根据 RangeTree 找到缺失区间并触发加载
   * - 加载时会就地填充 slots[index].track，并且维护 urlToIndex 映射
   */
  async getPage(page: number, limit: number) {
    const total = this.slots.length;
    const start = page * limit;
    const end = Math.min(start + limit, total);
    const missing: Range[] = this.rangeTree.diff(start, end);
    for (const [s, e] of missing) {
      await this.loadRange(s, e);
      this.rangeTree.add(s, e);
    }

    return this.peekPage(page, limit);
  }

  /**
   * loadRange: 由 dataSource 拉取 [start,end) 的真实 track 数据
   * 核心点：就地更新 this.slots[i].track（保持引用不变）
   */
  private async loadRange(start: number, end: number) {
    const ids: number[] = [];
    for (let i = start; i < end; i++) {
      const s = this.slots[i];
      if (s) {
        if (s.track) continue;
        if (s.loading) continue;
        s.loading = true;
        ids.push(s.id);
      }
    }
    if(ids.length === 0) return;
    const fetched = await this.dataSource.fetchTracksByIds(ids);
    const fetchedMap = new Map<number,NeteaseTrack>();
    for (const track of fetched) {
      fetchedMap.set(track.id, track);
    }

    for(let  i =start;i<end;i++){
      const s = this.slots[i]!;
      if(!s.loading && s.track) continue;
    }


  }

  private notify() {
    clearTimeout(this.notifyTimer);
    this.notifyTimer = window.setTimeout(() => {
      for (const fn of this.subscribers) fn();
    }, 200);
  }

  subscribe(fn: NormalFunc) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
}
