export class LyricTimeManager {
  private lyric: LyricLine[];
  private currentTime = 0; // ms
  private currentLineIndex = -1;
  private currentWordIndex = -1;
  private linesListeners = new Map<number, NormalFunc<[currentWordIndex: number]>>();
  onLineChange: Nullable<NormalFunc<[{ lineIndex: number; wordIndex: number }]>> = null;
  onWordChange: Nullable<NormalFunc<[{ lineIndex: number; wordIndex: number }]>> = null;

  constructor(lyric: LyricLine[]) {
    this.lyric = lyric;
    if (
      this.lyric.length === 1 &&
      this.lyric[0]!.words.map((w) => w.word)
        .join("")
        .includes("纯音乐")
    ) {
      this.lyric[0]!.startTime = 0;
      this.lyric[0]!.words[0]!.startTime = 0;
    }
  }

  private searchIndex(array: { startTime: number; endTime: number }[], start: number = 0) {
    for (let i = start; i < array.length; i++) {
      const item = array[i];
      if (item && this.currentTime >= item.startTime && this.currentTime <= item.endTime) {
        return i;
      }
    }
    for (let i = start - 1; i >= 0; i--) {
      const item = array[i];
      if (item && this.currentTime >= item.startTime && this.currentTime <= item.endTime) {
        return i;
      }
    }
    return -1;
  }

  private getLatestIndex() {
    if (this.lyric.length === 0) {
      return {
        lineIndex: -1,
        wordIndex: -1
      };
    }

    let lineIndex = this.searchIndex(this.lyric, this.currentLineIndex);
    if (lineIndex === -1) {
      const firstLine = this.lyric[0];
      const lastLine = this.lyric[this.lyric.length - 1];
      if (firstLine && this.currentTime < firstLine.startTime) {
        lineIndex = -1;
      } else if (lastLine && this.currentTime > lastLine.startTime) {
        lineIndex = this.lyric.length - 1;
      } else {
        lineIndex = this.currentLineIndex;
      }
    }

    const currentLine = this.lyric[lineIndex];
    let wordIndex;
    if (currentLine) {
      wordIndex = this.searchIndex(currentLine.words, this.currentWordIndex);
      if (wordIndex === -1) {
        const firstWord = currentLine.words[0];
        const lastWord = currentLine.words[currentLine.words.length - 1];
        if (firstWord && this.currentTime < firstWord.startTime) {
          wordIndex = -1;
        } else if (lastWord && this.currentTime > lastWord.startTime) {
          wordIndex = currentLine.words.length - 1;
        } else {
          wordIndex = this.currentWordIndex;
        }
      }
    } else {
      wordIndex = this.currentWordIndex;
    }

    return {
      lineIndex,
      wordIndex
    };
  }

  private execUpdate() {
    if (this.lyric.length === 0) return;
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

  /** ms */
  update = (deltaMS: number) => {
    this.currentTime += deltaMS;
    this.execUpdate();
    return this;
  };

  setCurrentTime = (ms: number) => {
    this.currentTime = ms;
    return this;
  };

  getCurrentTime() {
    return this.currentTime;
  }

  getCurrentIndex() {
    return {
      lineIndex: this.currentLineIndex,
      wordIndex: this.currentWordIndex
    };
  }

  addLineListener(lineIndex: number, callback: NormalFunc<[currentWordIndex: number]>) {
    this.linesListeners.set(lineIndex, callback);
  }

  removeLineListener(lineIndex: number) {
    this.linesListeners.delete(lineIndex);
  }

  dispose() {
    this.linesListeners.clear();
    this.onLineChange = null;
    this.onWordChange = null;
    this.lyric = [];
    return this;
  }

  reset(lyric: LyricLine[]) {
    this.currentTime = 0;
    this.currentLineIndex = -1;
    this.currentWordIndex = -1;
    this.lyric = lyric;
    return this;
  }
}
