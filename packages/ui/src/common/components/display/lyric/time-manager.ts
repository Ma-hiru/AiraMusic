import { Listenable } from "@/common/utils/listenable";
import { BinarySearch } from "@/common/utils/binary-search";

import type { LyricLineExtended } from "./utils";

type TimeManagerEvent = "line-change" | "word-change";

export class TimeManager extends Listenable<TimeManagerEvent> {
  private currentTime = 0; // ms
  private currentLineIndex = -1;
  private currentWordIndex = -1;

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
   * 找到当前应该聚焦的歌词行。
   * - 当前时间小于第一行开始时间：-1
   * - 当前时间 >= 某行 startTime：聚焦到这行
   * - 即使这行 endTime 已经过了，只要下一行还没开始，也继续停留在这行
   */
  private findLineIndex(time: number) {
    const lines = this.lyric;
    if (lines.length === 0) return -1;
    if (time < lines[0]!.startTime) return -1;
    return BinarySearch.findLastByMonotonicPredicate(lines, (l) => l.startTime <= time);
  }

  /**
   * 找到当前正在唱的 word。
   * - 只有 time 落在 word 的 [startTime, endTime) 内，才算当前 word
   * - 如果当前行已经结束，但下一行还没开始，返回 -1
   */
  private findWordIndex(line: Optional<LyricLine>, time: number) {
    if (!line || line.words.length === 0) return -1;
    return BinarySearch.findLastByMonotonicPredicate(line.words, (w) => w.startTime <= time);
  }

  private execUpdate() {
    const prevLineIdx = this.currentLineIndex;
    const prevWordIdx = this.currentWordIndex;
    const nextLineIdx = this.findLineIndex(this.currentTime);
    const nextWordIdx = this.findWordIndex(this.lyric[nextLineIdx], this.currentTime);

    this.currentLineIndex = nextLineIdx;
    this.currentWordIndex = nextWordIdx;

    prevLineIdx !== nextLineIdx && this.executeListeners("line-change", "sync");
    prevWordIdx !== nextWordIdx && this.executeListeners("word-change", "sync");
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
    return this.currentLineIndex;
  }

  getCurrentWordIndex() {
    return this.currentWordIndex;
  }

  getCurrentLine() {
    if (this.currentLineIndex < 0) return undefined;
    return this.lyric[this.currentLineIndex];
  }

  getCurrentWord() {
    const line = this.getCurrentLine();
    if (!line || this.currentWordIndex < 0) return undefined;
    return line.words[this.currentWordIndex];
  }

  reset(lyric: LyricLineExtended[]) {
    this.currentTime = 0;
    this.currentLineIndex = -1;
    this.currentWordIndex = -1;
    this.lyric = lyric;
    this.normalizeLyric();
    this.execUpdate();
    return this;
  }

  override [Symbol.dispose]() {
    this.lyric = [];
    this.currentTime = 0;
    this.currentLineIndex = -1;
    this.currentWordIndex = -1;
    super[Symbol.dispose]();
  }
}
