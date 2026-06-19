import { NeteaseHistoryRecord, NeteaseTrack } from "@/common/netease/models";
import { Listenable } from "@/common/utils/listenable";
import { NeteaseAPITrack } from "@/common/netease/api";

export default class RendererPlayerHistory extends Listenable {
  readonly list;
  readonly maxLength;

  get count() {
    return this.list.length;
  }

  constructor(props?: { list?: NeteaseHistoryRecord[]; maxLength?: number }) {
    super();
    this.list = props?.list ?? [];
    this.maxLength = props?.maxLength ?? 500;
  }

  override [Symbol.dispose]() {
    super[Symbol.dispose]();
  }

  locate(record: NeteaseHistoryRecord | number) {
    if (typeof record === "number") return this.list.findIndex((h) => h.detail.id === record);
    return this.list.findIndex((h) => h.detail.id === record.detail.id);
  }

  add(record: NeteaseHistoryRecord) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.list.splice(exitsPos, 1);
    this.list.unshift(record);
    NeteaseAPITrack.scrobble({
      id: record.id,
      sourceid:
        record.sourceName === "playlist" || record.sourceName === "album"
          ? record.sourceID
          : record.id,
      time: Math.floor(record.playDuration)
    }).finally(() => this.executeListeners());
  }

  remove(record: NeteaseHistoryRecord | number) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.list.splice(exitsPos, 1);
    this.executeListeners();
  }

  toSearchStruct() {
    return RendererPlayerHistory.toSearchStruct(this.list);
  }
  static toSearchStruct(list: NeteaseHistoryRecord[]) {
    return NeteaseTrack.toSearchStructString(list.map((h) => new NeteaseTrack(h.detail)));
  }

  static save(instance: RendererPlayerHistory) {
    return {
      list: instance.list,
      maxLength: instance.maxLength
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    save.list = save.list.map(NeteaseHistoryRecord.fromHistoryObject);
    return new RendererPlayerHistory(save);
  }
}
