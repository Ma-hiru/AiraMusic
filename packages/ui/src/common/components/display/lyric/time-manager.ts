import { zip } from "@/common/utils/iter";
import { Listenable } from "@/common/utils/listenable";
import { BinarySearch } from "@/common/utils/binary-search";

import type { LyricLineExtended } from "./utils";

export type TimeManagerEvent = "line-change" | "word-change";

export type LyricIndex = { line: number; word: number };

export class TimeManager extends Listenable<TimeManagerEvent> {
  private currentTime = 0; // ms
  private currentIndex: LyricIndex[] = [
    { line: -1, word: -1 } // 主歌词进度
    // 可能存在的对唱、背景
  ];

  constructor(private lyric: LyricLineExtended[]) {
    super();
    this.normalizeLyric();
  }

  private normalizeLyric() {
    this.lyric.sort((a, b) => a.startTime - b.startTime);
    for (const line of this.lyric) {
      line.words.sort((a, b) => a.startTime - b.startTime);
      if (line.endTime < line.startTime) {
        const lastWord = line.words.at(-1);
        line.endTime = lastWord?.endTime ?? line.startTime;
      }
    }
  }

  /**
   * 找到当前应该聚焦的歌词（多）行
   * - 当前时间小于第一行开始时间：-1
   * - 当前时间 >= 某行 startTime：聚焦到这行
   * - 即使这行 endTime 已经过了，只要下一行还没开始，也继续停留在这行
   */
  private findLineIndex(time: number) {
    const lines = this.lyric;
    if (lines.length === 0) return [-1];
    if (time < lines[0]!.startTime) return [-1];

    const ans: number[] = [];
    const last_active = BinarySearch.findLastByMonotonicPredicate(
      lines,
      (l) => l.startTime <= time
    );
    for (let i = last_active; i >= 0; i--) {
      time <= lines[i]!.endTime && ans.push(i);
    }

    // 两行之间的空档仍聚焦上一行
    return ans.length > 0 ? ans.reverse() : [last_active];
  }

  /**
   * 找到当前正在唱的 word
   * - 只有 time 落在 word 的 [startTime, endTime) 内，才算当前 word
   * - 如果当前行已经结束，但下一行还没开始，返回 -1
   */
  private findWordIndex(line: Optional<LyricLine>, time: number) {
    if (!line || line.words.length === 0) return -1;
    return BinarySearch.findLastByMonotonicPredicate(line.words, (w) => w.startTime <= time);
  }

  /**
   * 找到当前应该聚焦的歌词（多）行和 word
   * */
  private findNextIndex(time: number) {
    const nextLineIdx = this.findLineIndex(time);
    const nextWordIdx = nextLineIdx.map((l) => this.findWordIndex(this.lyric[l], time));
    return nextLineIdx.map((line, i) => ({ line, word: nextWordIdx[i]! }));
  }

  private isIndexLineChanged(prev?: LyricIndex, next?: LyricIndex) {
    if (!prev && !next) return false;
    if (!prev || !next) return true;
    return prev.line !== next.line;
  }

  private isIndexWordChanged(prev?: LyricIndex, next?: LyricIndex) {
    if (!prev && !next) return false;
    if (!prev || !next) return true;
    return prev.word !== next.word;
  }

  private execUpdate() {
    const prev = this.currentIndex;
    const current = this.findNextIndex(this.currentTime);
    this.currentIndex = current.length > 0 ? current : [{ line: -1, word: -1 }];

    for (const [p, c] of zip(prev, this.currentIndex, "longest")) {
      this.isIndexLineChanged(p, c) && this.executeListeners("line-change", "sync");
      this.isIndexWordChanged(p, c) && this.executeListeners("word-change", "sync");
    }
  }

  update = (deltaMS: number) => {
    this.currentTime += deltaMS;
    this.execUpdate();
    return this;
  };

  setCurrentTime = (ms: number) => {
    this.currentTime = Math.max(0, ms);
    return this;
  };

  getCurrentTime() {
    return this.currentTime;
  }

  getCurrentLineIndex() {
    return this.currentIndex.map((i) => i.line);
  }

  getCurrentWordIndex() {
    return this.currentIndex.map((i) => i.word);
  }

  getCurrentLine() {
    return this.currentIndex.filter((i) => i.line >= 0).map((idx) => this.lyric[idx.line]!);
  }

  getCurrentWord() {
    return this.currentIndex
      .filter((i) => i.word >= 0)
      .map((idx) => this.lyric[idx.line]!.words[idx.word]!);
  }

  reset(lyric: LyricLineExtended[]) {
    this.currentTime = 0;
    this.currentIndex = [{ line: -1, word: -1 }];
    this.lyric = lyric;
    this.normalizeLyric();
    this.execUpdate();
    return this;
  }

  override [Symbol.dispose]() {
    this.lyric = [];
    this.currentTime = 0;
    this.currentIndex = [{ line: -1, word: -1 }];
    super[Symbol.dispose]();
  }
}
