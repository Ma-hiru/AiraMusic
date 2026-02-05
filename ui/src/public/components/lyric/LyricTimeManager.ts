export class LyricTimeManager {
  readonly lyric: LyricLine[];
  private currentTime = 0; // ms
  private currentLineIndex = -1;
  private currentWordIndex = -1;
  private linesListeners = new Map<number, NormalFunc<[currentWordIndex: number]>>();

  onLineChange: Nullable<NormalFunc<[{ lineIndex: number; wordIndex: number }]>> = null;

  onWordChange: Nullable<NormalFunc<[{ lineIndex: number; wordIndex: number }]>> = null;

  // delta 单位为 ms
  update(deltaMS: number) {
    this.currentTime += deltaMS;
    this.execUpdate();
  }

  setCurrentTime(ms: number) {
    this.currentTime = ms;
    this.execUpdate();
  }

  private getLatestIndex() {
    let lineIndex = this.lyric.findIndex(
      (line) => this.currentTime >= line.startTime && this.currentTime < line.endTime
    );
    if (lineIndex === -1) {
      const lastLine = this.lyric[this.lyric.length - 1];
      if (lastLine && this.currentTime > lastLine.startTime) {
        lineIndex = this.lyric.length - 1;
      } else {
        lineIndex = this.currentLineIndex;
      }
    }

    const currentLine = this.lyric[lineIndex];
    let wordIndex = currentLine?.words.findIndex(
      (word) => this.currentTime >= word.startTime && this.currentTime < word.endTime
    );
    if (wordIndex === undefined) {
      wordIndex = this.currentWordIndex;
    }
    if (wordIndex === -1 && currentLine) {
      if (this.currentTime <= currentLine.endTime) {
        wordIndex = this.currentWordIndex;
      } else {
        wordIndex = currentLine.words.length - 1;
      }
    }

    return {
      lineIndex,
      wordIndex
    };
  }

  execUpdate() {
    // 更新当前词
    const { lineIndex, wordIndex } = this.getLatestIndex();
    const lineChanged = lineIndex !== this.currentLineIndex;
    const wordChanged = wordIndex !== this.currentWordIndex;
    if (lineChanged) {
      this.currentLineIndex = lineIndex;
      this.onLineChange &&
        window.requestAnimationFrame(() => {
          this.onLineChange?.({ lineIndex, wordIndex });
        });
    }
    if (wordChanged) {
      this.currentWordIndex = wordIndex;
      this.onWordChange &&
        window.requestAnimationFrame(() => {
          this.onWordChange?.({ lineIndex, wordIndex });
        });
    }
    if (lineChanged || wordChanged) {
      window.requestAnimationFrame(() => {
        this.linesListeners.get(lineIndex)?.(wordIndex);
      });
    }
  }

  addLineListener(lineIndex: number, callback: NormalFunc<[currentWordIndex: number]>) {
    this.linesListeners.set(lineIndex, callback);
  }

  constructor(lyric: LyricLine[]) {
    this.lyric = lyric.filter((l) => l.words.length > 0);
  }
}
