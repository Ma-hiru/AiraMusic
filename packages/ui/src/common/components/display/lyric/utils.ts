export interface LyricLineExtended extends LyricLine {
  endTime: number;
  startTime: number;
  embeds?: LyricEmbed[];
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

export function extendLyric(
  lyric: readonly LyricLine[],
  embeds: readonly LyricEmbed[] = [],
  duration?: number
): LyricLineExtended[] {
  // 展示层的归一化不能修改原始模型；缓存、IPC 和其他歌词视图还会复用它。
  const rows: LyricLineExtended[] = lyric.map((line) => ({
    ...line,
    words: line.words.map((word) => ({ ...word })),
    wait: false
  }));
  const groups = new Map<number, LyricEmbed[]>();
  for (const embed of embeds) {
    const time = Math.max(0, embed.t);
    const group = groups.get(time) ?? [];
    group.push(embed);
    groups.set(time, group);
  }
  for (const [startTime, content] of groups) {
    rows.push({
      startTime,
      endTime: startTime,
      words: [],
      translatedLyric: "",
      romanLyric: "",
      embeds: content.toSorted((a, b) => a.position - b.position),
      wait: false
    });
  }
  rows.sort((a, b) => a.startTime - b.startTime || Number(!!b.embeds) - Number(!!a.embeds));
  let nextStart: number | undefined;
  for (let index = rows.length - 1; index >= 0; index--) {
    const line = rows[index]!;
    if (rows[index + 1] && rows[index + 1]!.startTime > line.startTime) {
      nextStart = rows[index + 1]!.startTime;
    }
    const end = nextStart === undefined ? duration : nextStart - 1;
    if (line.embeds) {
      line.endTime = Math.max(line.startTime, end ?? line.startTime);
    } else if (line.endTime >= 59_999_999 && end !== undefined) {
      // LRC 的未知末尾不能跨过真正有时间的制作信息。
      line.endTime = Math.max(line.startTime, end);
      for (const word of line.words) word.endTime = Math.min(word.endTime, line.endTime);
    }
  }

  const res: LyricLineExtended[] = [];
  const wait: LyricLine[] = [];
  if ((rows[0]?.startTime ?? 0) > 5_000 && rows.length > 1) {
    rows.unshift({
      startTime: 0,
      endTime: rows[0]!.startTime,
      words: [],
      translatedLyric: "",
      romanLyric: "",
      isBlank: false,
      wait: false
    });
  }
  for (const line of rows) {
    const hasContent = !!line.embeds?.length || line.words.some((word) => word.word.trim());
    if (!hasContent) {
      wait.push(line);
    } else {
      if (wait.length) {
        wait[0]!.startTime = (res.at(-1)?.endTime ?? 0) + 1;
        wait.at(-1)!.endTime = line.startTime - 1;
        res.push(mergeWaitLines(wait));
      }
      wait.length = 0;
      res.push(line);
    }
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
