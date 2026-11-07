import type { MenuBarLyricWord } from "@mahiru/native";

/** 交给原生绘制的一行歌词 */
export type MenuLyricLine = {
  text: string;
  /** 行起始时间，用作切行去重 key */
  startTime: number;
  /** 逐字时间轴，时间为相对行首的毫秒；空数组表示静态文本 */
  words: MenuBarLyricWord[];
};

/** 无歌词时的占位行 */
export const BLANK_LYRIC_TEXT = "（音乐）";
/** 行时间轴缺失时的兜底时长 */
export const FALLBACK_LINE_MS = 4000;
/** 与 ui 的 TimeManager 一致：最多回看多少行去找同时激活的行 */
const ACTIVE_LOOKBACK = 5;

type NormalizedWord = {
  text: string;
  endMs: number;
  startMs: number;
  inlineNote: boolean;
};

/** 归一化后的一行 */
type TimelineLine = {
  text: string;
  endTime: number;
  startTime: number;
  words: MenuBarLyricWord[];
  /** 背景/和声行（对唱、TTML 背景），单行展示时让位给主歌词 */
  background: boolean;
};

const timelineCache = new WeakMap<NeteaseLyricModel, MenuLyricTimeline>();

/**
 * @desc 菜单栏歌词时间轴（只读，按歌词对象缓存） \
 * 解析规则对齐 ui 的 `TimeManager`：先归一化（排序、修正行结束时间），
 * 再按「当前时间 <= 行结束时间」回看多行找同时激活的行，最后取主歌词行转成原生结构
 */
export class MenuLyricTimeline {
  private readonly lines: TimelineLine[];

  constructor(lyric: Optional<NeteaseLyricModel>) {
    this.lines = normalizeLines(lyric?.data ?? []);
  }

  /** 取 `timeMS` 时刻应显示的那一行 */
  resolve(timeMS: number): Nullable<MenuLyricLine> {
    const index = this.findPrimaryLine(timeMS);
    if (index < 0) return null;

    const line = this.lines[index]!;
    if (!line.text) return { startTime: line.startTime, text: BLANK_LYRIC_TEXT, words: [] };
    return { startTime: line.startTime, text: line.text, words: line.words };
  }

  /**
   * 同时激活的行里取主歌词：优先非背景行，并列时取最晚开始的那一行 \
   * 时间落在两行空档时沿用上一行（与 TimeManager 一致）
   */
  private findPrimaryLine(timeMS: number) {
    const { lines } = this;
    if (lines.length === 0) return -1;

    const lastActive = findLastIndexByStartTime(lines, timeMS);
    if (lastActive < 0) return -1;

    const active: number[] = [];
    let miss = 0;
    for (let i = lastActive; i >= 0; i--) {
      if (miss >= ACTIVE_LOOKBACK) break;
      if (timeMS <= lines[i]!.endTime) active.push(i);
      else miss++;
    }

    if (active.length === 0) return lastActive;
    active.reverse();
    const primary = active.findLast((index) => !lines[index]!.background);
    return primary ?? active[active.length - 1]!;
  }
}

/** 同一个歌词对象只解析一次（bus 每次换歌都会给新对象） */
export function getMenuLyricTimeline(lyric: Optional<NeteaseLyricModel>) {
  if (!lyric) return new MenuLyricTimeline(null);
  const cached = timelineCache.get(lyric);
  if (cached) return cached;
  const timeline = new MenuLyricTimeline(lyric);
  timelineCache.set(lyric, timeline);
  return timeline;
}

export function resolveMenuLyricLine(
  lyric: Optional<NeteaseLyricModel>,
  timeMS: number
): Nullable<MenuLyricLine> {
  return getMenuLyricTimeline(lyric).resolve(timeMS);
}

function normalizeLines(source: LyricLine[]): TimelineLine[] {
  const sorted = [...source].sort((a, b) => a.startTime - b.startTime);

  return sorted.map((line, index) => {
    const words = normalizeWords(line);
    const durationMS = resolveLineDuration(line, words, sorted[index + 1]?.startTime);
    const menuWords = toMenuWords(words, durationMS);

    return {
      startTime: line.startTime,
      endTime: line.endTime > line.startTime ? line.endTime : line.startTime + durationMS,
      // 文本必须由词表拼出，原生按词宽累计的高亮边界才与字形一致
      text: menuWords.map((word) => word.text).join(""),
      words: menuWords,
      background: !!(line.isBG || line.isBackChorus)
    };
  });
}

/** 词级时间轴：排序后折算成相对行首 */
function normalizeWords(line: LyricLine): NormalizedWord[] {
  return [...line.words]
    .sort((a, b) => a.startTime - b.startTime)
    .map((word) => ({
      startMs: Math.max(0, word.startTime - line.startTime),
      endMs: Math.max(0, word.endTime - line.startTime),
      text: word.word,
      inlineNote: !!word.inlineNote
    }));
}

function resolveLineDuration(
  line: LyricLine,
  words: NormalizedWord[],
  nextStartTime: Undefinable<number>
) {
  if (line.endTime > line.startTime) return Math.max(400, line.endTime - line.startTime);
  if (typeof nextStartTime === "number" && nextStartTime > line.startTime) {
    return Math.max(400, nextStartTime - line.startTime);
  }
  const lastWordEnd = words.at(-1)?.endMs ?? 0;
  return Math.max(400, lastWordEnd, FALLBACK_LINE_MS);
}

/** 剔除注音、裁掉行首尾空白，并给单一时间轴补出可推进的区间 */
function toMenuWords(words: NormalizedWord[], durationMS: number): MenuBarLyricWord[] {
  const kept = words
    .filter((word) => !word.inlineNote)
    .map((word) => ({ startMs: word.startMs, endMs: word.endMs, text: word.text }));

  const first = kept[0];
  const last = kept[kept.length - 1];
  // 行首尾空白会让原生累计出来的高亮宽度比实际文本长
  if (first) first.text = first.text.trimStart();
  if (last) last.text = last.text.trimEnd();

  const trimmed = kept.filter((word) => word.text.length > 0);
  const only = trimmed[0];
  // 逐行时间轴（LRC）没有词级信息：铺满整行做一次匀速推进
  if (trimmed.length === 1 && only && only.endMs <= only.startMs) {
    return [{ startMs: 0, endMs: durationMS, text: only.text }];
  }
  return trimmed;
}

function findLastIndexByStartTime(lines: readonly TimelineLine[], timeMS: number) {
  let left = 0;
  let right = lines.length - 1;
  let result = -1;
  while (left <= right) {
    const mid = (left + right) >>> 1;
    if (lines[mid]!.startTime <= timeMS) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return result;
}
