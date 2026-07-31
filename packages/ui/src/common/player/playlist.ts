import { shuffle } from "lodash-es";
import { Listenable } from "@/common/utils/listenable";
import { NeteaseTrackRecord } from "@/common/netease/models";

type PlayableResult = { reason: string; playable: boolean };

export default class RendererPlayerPlaylist extends Listenable {
  //#region fields
  /** 规范序 */
  private tracks: NeteaseTrackRecord[];
  /** 播放/显示序：tracks 下标的一个排列，shuffle 关时为 0..n-1，开时为打乱排列 */
  private order: number[];
  /** 当前位置：order 的下标（-1 表示空闲）current = tracks[order[cursor]] */
  private cursor: number;
  private _repeat: "all" | "off" | "one";
  private _shuffle: boolean;
  private _loop: boolean;
  // 可播判定与不可播提示由外部（播放器）注入，使本类不依赖 UI/用户态、可独立测试
  private playableOf: NormalFunc<[record: NeteaseTrackRecord], PlayableResult> = () => ({
    playable: true,
    reason: ""
  });
  private onUnplayable?: (reason: string) => void;

  get loop() {
    return this._loop;
  }

  private set loop(value) {
    this._loop = value;
    this.executeListeners();
  }

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

  /** 切换随机，重建 order/cursor */
  private changeShuffle(value: boolean) {
    const headTrackIdx = this.order[this.cursor] ?? -1; // 当前曲目在 tracks 中的下标
    this.rebuildOrder(value, headTrackIdx);
    this._shuffle = value;
  }

  /**
   * 重建 order/cursor。
   * on 把 headTrackIdx 放在最前、其余打乱，cursor=0，当前曲目继续播，后续是新随机
   */
  private rebuildOrder(shuffleOn: boolean, headTrackIdx: number) {
    const n = this.tracks.length;
    const identity = Array.from({ length: n }, (_, i) => i);
    if (!shuffleOn) {
      this.order = identity;
      this.cursor = headTrackIdx >= 0 && headTrackIdx < n ? headTrackIdx : -1;
      return;
    }
    if (headTrackIdx >= 0 && headTrackIdx < n) {
      this.order = [headTrackIdx, ...shuffle(identity.filter((i) => i !== headTrackIdx))];
      this.cursor = 0;
    } else {
      this.order = shuffle(identity);
      this.cursor = -1;
    }
  }

  constructor(props?: {
    loop?: boolean;
    shuffle?: boolean;
    position?: -1 | number;
    repeat?: "all" | "off" | "one";
    playlist?: NeteaseTrackRecord[];
  }) {
    super();
    this.tracks = props?.playlist ? [...props.playlist] : [];
    this._repeat = props?.repeat ?? "off";
    this._shuffle = props?.shuffle ?? false;
    this._loop = props?.loop ?? false;
    this.order = [];
    this.cursor = -1;
    // position 是规范序下标，与 save 持久化的口径一致
    this.rebuildOrder(this._shuffle, props?.position ?? -1);
  }
  //#endregion

  //#region inner methods
  static save(instance: RendererPlayerPlaylist) {
    return {
      // 持久化规范序下标
      position: instance.order[instance.cursor] ?? -1,
      repeat: instance._repeat,
      playlist: instance.tracks,
      _shuffle: instance._shuffle,
      _loop: instance._loop
    };
  }

  static fromSave(props: ReturnType<typeof this.save>) {
    const playlist = props.playlist.map(
      NeteaseTrackRecord.fromRecordObject
    ) as NeteaseTrackRecord[];
    return new RendererPlayerPlaylist({
      playlist,
      position: props.position,
      repeat: props.repeat,
      shuffle: props._shuffle,
      loop: props._loop
    });
  }

  [Symbol.iterator]() {
    let i = -1;
    return {
      next: () => {
        i++;
        const trackIdx = this.order[i];
        return {
          done: !this.check(i),
          value: trackIdx === undefined ? undefined : this.tracks[trackIdx]
        };
      }
    };
  }

  override [Symbol.dispose]() {
    super[Symbol.dispose]();
    this.tracks = [];
    this.order = [];
    this.cursor = -1;
    this._shuffle = false;
    this._loop = false;
    this.repeat = "off";
  }

  [Symbol.toPrimitive](hint: string) {
    if (hint === "string") {
      return `AppPlaylist(${this.order.length} tracks, position: ${this.cursor}, repeat: ${this.repeat}, shuffle: ${this.shuffle})`;
    } else if (hint === "number") {
      return this.cursor;
    }
    return this;
  }

  /** 按显示序下标取track */
  private recordAt(displayIdx: number): Nullable<NeteaseTrackRecord> {
    const trackIdx = this.order[displayIdx];
    if (trackIdx === undefined) return null;
    const record = this.tracks[trackIdx];
    return record && record.detail ? record : null;
  }
  //#endregion

  /** 返回当前显示序（播放序）列表 */
  public list() {
    return this.order.map((i) => this.tracks[i]!);
  }

  /** 返回当前原始序列表 */
  public listRaw() {
    return this.tracks;
  }

  public pos() {
    return this.cursor;
  }

  /** 传入 id 或 record，返回其在显示序中的下标 */
  public locate(source: Optional<number> | NeteaseTrackRecord) {
    if (typeof source !== "number" && !source) return -1;
    const id = typeof source === "object" ? source.id : source;
    return this.order.findIndex((i) => this.tracks[i]!.id === id);
  }

  public replace(list: NeteaseTrackRecord[], initPosition: number | NeteaseTrackRecord = -1) {
    this.tracks = [...list];
    const headTrackIdx =
      typeof initPosition === "number"
        ? initPosition
        : this.tracks.findIndex((t) => t.id === initPosition.id);
    this.rebuildOrder(this._shuffle, headTrackIdx);
    this.executeListeners();
    return this;
  }

  public clear() {
    this.tracks = [];
    this.order = [];
    this.cursor = -1;
    this.executeListeners();
    return this;
  }

  public remove(pos: number | NeteaseTrackRecord) {
    const d = typeof pos === "number" ? pos : this.locate(pos);
    if (d < 0 || d >= this.order.length) return this;

    const trackIdx = this.order[d]!;
    this.tracks.splice(trackIdx, 1);
    this.order.splice(d, 1);
    // tracks 压缩后，修正 order 中所有大于被删下标的引用
    for (let i = 0; i < this.order.length; i++) {
      if (this.order[i]! > trackIdx) this.order[i] = this.order[i]! - 1;
    }

    // 按显示序修正 cursor，删点在当前之前则 -1
    // 删的是当前则保持（指向下一首）
    // 越界则收回
    if (d < this.cursor) this.cursor--;
    if (this.cursor >= this.order.length) this.cursor = this.order.length - 1;

    this.executeListeners();
    return this;
  }

  public add(record: NeteaseTrackRecord, position: "end" | "next") {
    const existD = this.locate(record);
    const isCurrent = existD !== -1 && existD === this.cursor;

    // 当前曲目自己“下一首播放”无意义
    if (isCurrent && position === "next") {
      this.executeListeners();
      return this;
    }

    // 去重：已存在则先移除（remove 会维护 tracks/order/cursor）
    if (existD !== -1) this.remove(existD);

    const trackIdx = this.tracks.length;
    this.tracks.push(record);

    if (position === "end") {
      this.order.push(trackIdx);
      if (isCurrent) this.cursor = this.order.length - 1; // 当前曲目被移到末尾，仍为当前
    } else {
      // 紧跟当前之后插入（cursor=-1 时插到最前），不重洗 → shuffle 下“下一首”保持有效
      this.order.splice(this.cursor + 1, 0, trackIdx);
    }

    this.executeListeners();
    return this;
  }

  public addList(records: NeteaseTrackRecord[]) {
    if (records.length === 0) return this;

    // 入参去重：同一 id 保留最后一次出现的位置（与逐个 add 的结果一致）
    const incomingIds = new Set<number>();
    const incoming: NeteaseTrackRecord[] = [];
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i]!;
      if (!incomingIds.has(record.id)) {
        incomingIds.add(record.id);
        incoming.push(record);
      }
    }
    incoming.reverse();

    const currentRecord = this.current();
    const keptTracks = this.tracks.filter((t) => !incomingIds.has(t.id));
    const keptDisplay = this.order
      .map((i) => this.tracks[i]!)
      .filter((t) => !incomingIds.has(t.id));
    const newTracks = keptTracks.concat(incoming);
    const newDisplay = keptDisplay.concat(incoming);

    // 由 id→规范序下标 一次性重建 order
    const trackIndexById = new Map<number, number>();
    newTracks.forEach((t, idx) => trackIndexById.set(t.id, idx));

    this.tracks = newTracks;
    this.order = newDisplay.map((t) => trackIndexById.get(t.id)!);
    this.cursor = currentRecord ? newDisplay.findIndex((t) => t.id === currentRecord.id) : -1;

    this.executeListeners();
    return this;
  }

  public jump(pos: number | NeteaseTrackRecord) {
    const target = typeof pos === "number" ? pos : this.locate(pos);
    if (this.check(target) && this.cursor !== target) {
      this.cursor = target;
    }
    this.executeListeners();
    return this;
  }

  public same(list: NeteaseTrackRecord[]) {
    if (this.tracks.length !== list.length) return false;
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.tracks[i]!.detail.id !== list[i]!.detail.id) return false;
      if (this.tracks[i]!.sourceID !== list[i]!.sourceID) return false;
    }
    return true;
  }

  public check(pos: number | NeteaseTrackRecord = this.cursor) {
    if (typeof pos !== "number") return this.locate(pos) !== -1;
    return (pos >= 0 && pos < this.order.length) || (pos == -1 && this.order.length > 0);
  }

  public current() {
    return this.recordAt(this.cursor);
  }

  public bindPlayability(
    playableOf: (record: NeteaseTrackRecord) => PlayableResult,
    onUnplayable?: (reason: string) => void
  ) {
    this.playableOf = playableOf;
    this.onUnplayable = onUnplayable;
    return this;
  }

  /**
   * 从 from 向 direction 走一步的显示序下标，含 repeat="all" 环绕
   * 无环绕到头返回 -1
   * */
  private advance(direction: 1 | -1, from = this.cursor): number {
    const len = this.order.length;
    if (len === 0) return -1;
    const pos = from + direction;
    if (pos >= len) return this.repeat === "all" ? 0 : -1;
    if (pos < 0) return this.repeat === "all" ? len - 1 : -1;
    return pos;
  }

  /**
   * 沿 direction 移动到下一个可播曲目，跳过不可播的
   * 最多遍历整列一遍，避免"全员不可播 + repeat=all"时的无限递归
   * 全不可播则置 -1
   */
  private moveToPlayable(direction: 1 | -1) {
    const len = this.order.length;
    let pos = this.advance(direction);
    let skippedReason = "";

    for (let tried = 0; tried < len; tried++) {
      if (pos === -1) break;
      const record = this.recordAt(pos);
      if (record) {
        const { reason, playable } = this.playableOf(record);
        if (playable) {
          this.cursor = pos;
          skippedReason && this.onUnplayable?.(skippedReason);
          return;
        }
        skippedReason ||= reason;
      }
      pos = this.advance(direction, pos);
    }

    this.cursor = -1;
    skippedReason && this.onUnplayable?.(skippedReason);
  }

  public peek(force = true): Nullable<NeteaseTrackRecord> {
    if (!force && this.repeat === "one") return this.current();
    const len = this.order.length;
    let pos = this.advance(1);
    for (let tried = 0; tried < len; tried++) {
      if (pos === -1) break;
      const record = this.recordAt(pos);
      if (record && this.playableOf(record).playable) return record;
      pos = this.advance(1, pos);
    }
    return null;
  }

  public next(force = true): this {
    if (!force && this.repeat === "one") return this;
    this.moveToPlayable(1);
    this.executeListeners();
    return this;
  }

  public last(force = true): this {
    if (!force && this.repeat === "one") return this;
    this.moveToPlayable(-1);
    this.executeListeners();
    return this;
  }
}
