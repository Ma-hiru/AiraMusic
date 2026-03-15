import { NeteaseHistory } from "@mahiru/ui/public/models/netease";
import { Listenable } from "@mahiru/ui/public/models/Listenable";

export default class AppHistory extends Listenable {
  readonly history;
  readonly maxLength;

  constructor(props?: { history?: NeteaseHistory[]; maxLength?: number }) {
    super();
    this.history = props?.history ?? [];
    this.maxLength = props?.maxLength ?? 500;
  }

  [Symbol.dispose]() {
    super[Symbol.dispose]();
  }

  locate(record: NeteaseHistory | number) {
    if (typeof record === "number") return this.history.findIndex((h) => h.track.id === record);
    return this.history.findIndex((h) => h.track.id === record.track.id);
  }

  add(record: NeteaseHistory) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.history.splice(exitsPos, 1);
    this.history.unshift(record);
    this.executeListeners();
  }

  remove(record: NeteaseHistory | number) {
    const exitsPos = this.locate(record);
    if (exitsPos !== -1) this.history.splice(exitsPos, 1);
    this.executeListeners();
  }

  static save(instance: AppHistory) {
    return {
      history: instance.history,
      maxLength: instance.maxLength
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    save.history = <NeteaseHistory[]>save.history.map(NeteaseHistory.fromObject);
    return new AppHistory(save);
  }
}
