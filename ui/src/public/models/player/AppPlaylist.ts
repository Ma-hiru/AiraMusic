import { shuffle } from "lodash-es";
import { Listenable } from "@mahiru/ui/public/models/Listenable";
import { NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";

export default class AppPlaylist extends Listenable {
  //region fields
  private playlist;
  private position;
  private playlistBackup;
  private _repeat;
  private _shuffle;

  get repeat() {
    return this._repeat;
  }

  set repeat(value) {
    this._repeat = value;
    this.executeListeners();
  }

  set shuffle(value) {
    this.changeShuffle(value);
    this.executeListeners();
  }

  get shuffle() {
    return this._shuffle;
  }

  constructor(props?: {
    position?: number | -1;
    playlist?: NeteaseTrackRecord[];
    repeat?: "off" | "one" | "all";
    shuffle?: boolean;
  }) {
    super();
    this.playlist = props?.playlist ?? [];
    this.playlistBackup = props?.playlist ?? [];
    this.position = props?.position ?? -1;
    this._repeat = props?.repeat ?? "off";
    this._shuffle = props?.shuffle ?? false;
  }

  //endregion

  static save(instance: AppPlaylist) {
    const current = instance.current();
    return {
      position: instance.shuffle
        ? instance.playlistBackup.findIndex((item) => item.track.id === current?.track.id)
        : instance.position,
      repeat: instance.repeat,
      playlist: instance.shuffle ? instance.playlistBackup : instance.playlist,
      _shuffle: instance.shuffle
    };
  }

  static fromSave(props: ReturnType<typeof this.save>) {
    props.playlist = <NeteaseTrackRecord[]>props.playlist.map(NeteaseTrackRecord.fromObject);
    const instance = new AppPlaylist(props);
    instance.shuffle = props._shuffle;
    return instance;
  }

  [Symbol.iterator]() {
    let pos = -1;
    return {
      next: () => {
        pos++;
        return {
          done: this.check(pos),
          value: this.playlist[pos]
        };
      }
    };
  }

  [Symbol.dispose]() {
    super[Symbol.dispose]();
    this.playlist = [];
    this.playlistBackup = [];
    this.position = -1;
    this._shuffle = false;
    this.repeat = "off";
  }

  list() {
    return this.playlist;
  }

  pos() {
    return this.position;
  }

  locate(id: Optional<number>) {
    if (typeof id !== "number") return -1;
    return this.playlist.findIndex((item) => item.track.id === id);
  }

  private changeShuffle(value: boolean) {
    if (value) {
      const current = this.current();
      this.playlistBackup = this.playlist;
      this.playlist = shuffle(this.playlist);
      this.position = this.locate(current?.track.id);
    } else {
      const current = this.current();
      this.playlist = this.playlistBackup;
      this.position = this.locate(current?.track.id);
    }
    this._shuffle = value;
  }

  replace(list: NeteaseTrackRecord[], initPosition: number | NeteaseTrackRecord = -1) {
    const shouldBackup = this.shuffle;
    shouldBackup && this.changeShuffle(false);
    this.playlist = list;
    this.jump(initPosition);
    shouldBackup && this.changeShuffle(true);
    this.executeListeners();
    return this;
  }

  clear() {
    const shouldBackup = this.shuffle;
    shouldBackup && this.changeShuffle(false);
    this.playlist = [];
    this.position = -1;
    shouldBackup && this.changeShuffle(true);
    this.executeListeners();
    return this;
  }

  remove(pos: number) {
    const shouldBackup = this.shuffle;
    shouldBackup && this.changeShuffle(false);
    if (!this.check(pos) || pos < 0) return this;

    this.playlist.splice(pos, 1);
    if (pos >= this.position) {
      // 删除位置在当前播放位置之后 或者 删除位置就是当前播放位置，不调整
    } else if (pos < this.position) {
      // 删除位置在当前播放位置之前，当前位置-1
      this.position--;
    }
    // 检查当前位置是否合法
    if (this.position >= this.playlist.length) {
      this.position = this.playlist.length - 1;
    }

    shouldBackup && this.changeShuffle(true);
    this.executeListeners();
    return this;
  }

  add(record: NeteaseTrackRecord, position: "next" | "end") {
    const shouldBackup = this.shuffle;
    shouldBackup && this.changeShuffle(false);

    const existPos = this.locate(record.track.id);
    const isCurrent = existPos === this.position;

    if (isCurrent) {
      if (position === "end") {
        this.remove(existPos);
        this.playlist.push(record);
        this.position = this.playlist.length - 1;
      }
    } else {
      if (existPos !== -1) this.remove(existPos);
      if (position === "end") {
        this.playlist.push(record);
      } else {
        this.playlist.splice(this.position + 1, 0, record);
      }
    }

    shouldBackup && this.changeShuffle(true);
    this.executeListeners();
    return this;
  }

  addList(records: NeteaseTrackRecord[]) {
    const shouldBackup = this.shuffle;
    shouldBackup && this.changeShuffle(false);

    for (const record of records) {
      const existPos = this.locate(record.id);
      const isCurrent = existPos === this.position;

      if (existPos !== -1) this.remove(existPos);
      if (isCurrent) this.position = this.playlist.length - 1;
      this.playlist.push(record);
    }

    shouldBackup && this.changeShuffle(true);
    this.executeListeners();
    return this;
  }

  jump(pos: number | NeteaseTrackRecord) {
    let position;
    if (typeof pos === "number") {
      position = pos;
    } else {
      position = this.playlist.findIndex((item) => item.id === pos.id);
    }
    if (this.check(position) && this.position !== pos) {
      this.position = position;
    }
    this.executeListeners();
    return this;
  }

  same(list: NeteaseTrackRecord[]) {
    if (this.playlist === list) return true;
    if (this.playlist.length !== list.length) return false;
    for (let i = 0; i < this.playlist.length; i++) {
      if (this.playlist[i]!.track.id !== list[i]!.track.id) return false;
      if (this.playlist[i]!.sourceID !== list[i]!.sourceID) return false;
    }
    return true;
  }

  check(pos = this.position) {
    return (pos >= 0 && pos < this.playlist.length) || (pos == -1 && this.playlist.length > 0);
  }

  current() {
    const record = this.playlist[this.position];
    if (!record || !record.track) return null;
    return record;
  }

  peek(force = true) {
    const currentPos = this.position;
    const peek = this.next(force).current();
    this.position = currentPos;
    return peek;
  }

  next(force = true) {
    if (!force && this.repeat === "one") return this;

    let nextPos = this.position + 1;
    if (nextPos >= this.playlist.length) {
      if (this.repeat === "all" && this.playlist.length >= 1) {
        // 列表循环
        nextPos = 0;
      } else {
        // 播放结束
        nextPos = -1;
      }
    }
    this.position = nextPos;

    this.executeListeners();
    return this;
  }

  last(force = true) {
    if (!force && this.repeat === "one") return this;

    let lastPos = this.position - 1;
    if (lastPos < 0) {
      if (this.repeat === "all" && this.playlist.length >= 1) {
        // 列表循环
        lastPos = this.playlist.length - 1;
      } else {
        // 播放结束
        lastPos = -1;
      }
    }
    this.position = lastPos;

    this.executeListeners();
    return this;
  }
}
