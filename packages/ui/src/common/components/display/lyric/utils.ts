export interface LyricLineExtended extends LyricLine {
  endTime: number;
  startTime: number;
  wait:
    | false
    | {
        total: number;
        steps: {
          idx: number;
          endTime: number;
          startTime: number;
        }[];
      };
}

export function extendLyric(lyric: LyricLine[]): LyricLineExtended[] {
  const res: LyricLineExtended[] = [];
  const wait: LyricLine[] = [];

  // 如果第一行的起始时间大于 5s，且不是单行，就插入一个空白行
  if ((lyric.at(0)?.startTime ?? 0) > 5_000 && lyric.length > 1) {
    lyric.unshift({
      startTime: 0,
      endTime: lyric.at(0)!.startTime,
      words: [],
      translatedLyric: "",
      romanLyric: "",
      isBlank: false,
      isBackChorus: false
    });
  }

  for (const line of lyric) {
    const hasWords = !!line.words
      .map((w) => w.word)
      .join("")
      .trim();

    if (!hasWords) {
      wait.push(line);
      continue;
    } else if (wait.length) {
      wait.at(0)!.startTime = (res.at(-1)?.endTime ?? 0) + 1;
      wait.at(-1)!.endTime = line.startTime - 1;
      res.push(mergeWaitLines(wait));
    }

    wait.length = 0;
    res.push({ ...line, wait: false });
  }

  return res;
}

function mergeWaitLines(lines: LyricLine[]): LyricLineExtended {
  const totalTime = lines.at(-1)!.endTime - lines.at(0)!.startTime;
  if (totalTime < 5_000) {
    return {
      startTime: lines.at(0)!.startTime,
      endTime: lines.at(-1)!.endTime,
      words: lines.flatMap((l) => l.words),
      translatedLyric: "",
      romanLyric: "",
      isBlank: false,
      isBackChorus: false,
      wait: false
    };
  }

  const gap = Math.floor(totalTime / 3);
  const steps = [
    { startTime: lines.at(0)!.startTime, endTime: lines.at(0)!.startTime + gap, idx: 0 },
    { startTime: lines.at(0)!.startTime + gap, endTime: lines.at(-1)!.endTime - gap, idx: 1 },
    { startTime: lines.at(-1)!.endTime - gap, endTime: lines.at(-1)!.endTime, idx: 2 }
  ];

  return {
    startTime: steps.at(0)!.startTime,
    endTime: steps.at(-1)!.endTime,
    words: steps.map((s, index) => ({
      word: index === 0 || index === steps.length - 1 ? "●" : " ● ",
      startTime: s.startTime,
      endTime: s.endTime
    })),
    translatedLyric: "",
    romanLyric: "",
    isBlank: false,
    isBackChorus: true,
    wait: {
      total: steps.length,
      steps
    }
  };
}
