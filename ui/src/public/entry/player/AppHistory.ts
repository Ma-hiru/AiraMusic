import { NeteaseHistory, NeteaseTrack } from "@mahiru/ui/public/models/netease";
import { Listenable } from "@mahiru/ui/public/models/Listenable";
import NCM_API from "@mahiru/ui/public/api";

export default class AppHistory extends Listenable {
  readonly list;
  readonly maxLength;

  get count() {
    return this.list.length;
  }

  constructor(props?: { list?: NeteaseHistory[]; maxLength?: number }) {
    super();
    this.list = props?.list ?? [];
    this.maxLength = props?.maxLength ?? 500;
  }

  [Symbol.dispose]() {
    super[Symbol.dispose]();
  }

  locate(record: NeteaseHistory | number) {
    if (typeof record === "number") return this.list.findIndex((h) => h.detail.id === record);
    return this.list.findIndex((h) => h.detail.id === record.detail.id);
  }

  add(record: NeteaseHistory) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.list.splice(exitsPos, 1);
    this.list.unshift(record);
    if (record.sourceName === "playlist" || record.sourceName === "album") {
      void NCM_API.Track.scrobble({
        id: record.id,
        sourceid: record.sourceID,
        time: Math.floor(record.playDuration / 1000)
      });
    }
    this.executeListeners();
  }

  remove(record: NeteaseHistory | number) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.list.splice(exitsPos, 1);
    this.executeListeners();
  }

  toSearchStruct() {
    return NeteaseTrack.toSearchStructString(this.list.map((h) => new NeteaseTrack(h.detail)));
  }

  static save(instance: AppHistory) {
    return {
      list: instance.list,
      maxLength: instance.maxLength
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    save.list = <NeteaseHistory[]>save.list.map(NeteaseHistory.fromObject) || [];
    return new AppHistory(save);
  }
}
