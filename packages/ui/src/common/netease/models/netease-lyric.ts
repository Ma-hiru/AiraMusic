import { z } from "zod";
import { TTMLParser, toAmllLyrics } from "@applemusic-like-lyrics/ttml";
import {
  parseLrc,
  parseQrc,
  parseYrc,
  type TTMLLyric,
  type LyricLine as AMLyricLine
} from "@applemusic-like-lyrics/lyric";
import { Log } from "@/common/lib/log";
import { RendererLyricConstants } from "@/common/constants/lyric";
import { lyricLanguages, preferredLyricLanguage } from "@/common/lib/lyric-language";
import {
  LyricLineInfo,
  parseExternalLrc,
  parseNeteaseLyric,
  parseTranslatedLRC,
  normalizeLyricLines
} from "@mahiru/wasm";

const LyricEmbedContentSchema = z.object({
  tx: z.string(),
  li: z.string().optional(),
  or: z.string().optional()
});
const LyricEmbedSchema = z.object({
  t: z.number().finite(),
  c: z.array(LyricEmbedContentSchema),
  position: z.number().int().nonnegative()
});

const localTTMLTips = "歌词来源：AppleMusic & QQ音乐 (实验性)";

export const NeteaseLyricSchema = z.object({
  id: z.number().optional(),
  tips: z.string().optional(),
  isLocalTTML: z.boolean().optional(),
  embeds: z.array(LyricEmbedSchema).optional(),
  duration: z.number().finite().nonnegative().optional(),
  data: z
    .array(
      z.object({
        words: z
          .array(
            z.object({
              startTime: z.number().describe("单词的起始时间，单位为毫秒"),
              endTime: z.number().describe("单词的结束时间，单位为毫秒"),
              word: z.string().describe("单词内容"),
              romanWord: z.string().optional().describe("单词的音译，可用于上方注音"),
              inlineNote: z
                .boolean()
                .optional()
                .describe("是否为内嵌注释，比如日文汉字的平假名和片假名")
            })
          )
          .describe("该行的所有单词"),
        translatedLyric: z.string().describe("该行的翻译歌词，将会显示在主歌词行的下方"),
        translations: z
          .array(
            z.object({
              language: z.string().optional(),
              text: z.string(),
              words: z
                .array(
                  z.object({
                    word: z.string(),
                    startTime: z.number(),
                    endTime: z.number(),
                    romanWord: z.string().optional()
                  })
                )
                .optional()
            })
          )
          .optional(),
        romanLyric: z.string().describe("该行的音译歌词，将会显示在翻译歌词行的下方"),
        startTime: z.number().describe("该行的起始时间，单位为毫秒"),
        endTime: z.number().describe("该行的结束时间，单位为毫秒"),
        isBlank: z.boolean().optional().describe("是否为空白行"),
        isBackChorus: z.boolean().optional().describe("是否为和声行"),
        isBG: z.boolean().optional(),
        isDuet: z.boolean().optional()
      })
    )
    .default([]),
  rmExisted: z.boolean().optional().default(false),
  tlExisted: z.boolean().optional().default(false),
  noteExisted: z.boolean().optional().default(false)
});

export class NeteaseLyric implements NeteaseLyricModel {
  //region fields
  readonly data: LyricLine[];
  readonly tips;
  readonly rmExisted;
  readonly tlExisted;
  readonly noteExisted;
  readonly id;
  readonly embeds;
  readonly duration;
  readonly isLocalTTML;

  constructor(props: Partial<NeteaseLyricModel>) {
    this.data = props.data || [];
    this.rmExisted = props.rmExisted || false;
    this.tlExisted =
      !!props.tlExisted ||
      this.data.some(
        (line) =>
          line.translatedLyric?.trim() ||
          line.translations?.some((translation) => translation.text.trim())
      );
    this.noteExisted = props.noteExisted || false;
    this.tips = props.tips || "";
    this.isLocalTTML = props.isLocalTTML ?? props.tips === localTTMLTips;
    this.id = props.id;
    this.embeds = props.embeds;
    this.duration = props.duration;
  }
  //endregion

  get key(): string {
    return `${this.id || 0}_${this.tips}_${this.data?.length || 0}_${this.rmExisted}_${this.tlExisted}_${this.isLocalTTML}`;
  }

  get info() {
    return {
      rmExisted: this.rmExisted,
      tlExisted: this.tlExisted,
      noteExisted: this.noteExisted,
      canShowNotes: this.canShowNotes,
      lineCount: this.data.length,
      tips: this.tips,
      translationLanguages: this.translationLanguages
    };
  }

  /** 注音可来自原文中的假名，也可来自独立时间轴匹配出的逐词音译。 */
  get canShowNotes(): boolean {
    return (
      this.noteExisted ||
      this.data.some((line) => line.words.some((word) => word.romanWord?.trim()))
    );
  }

  get priority(): number {
    if (this.data.length <= 0) return 0;

    let priority = 0;
    this.hasWordTiming() && priority++;
    this.rmExisted && this.data.some((line) => line.romanLyric?.trim()) && (priority += 2);
    this.tlExisted && (priority += 2);
    this.noteExisted && (priority += 1);

    return priority;
  }

  get translationLanguages(): string[] {
    return lyricLanguages(this.data);
  }

  /** 多个非空词有独立有效计时，才能算逐字，不能只看分词数量。 */
  hasWordTiming(): boolean {
    return this.data.some((line) => {
      const words = line.words.filter(
        (word) =>
          !word.inlineNote &&
          word.word.trim() &&
          Number.isFinite(word.startTime) &&
          Number.isFinite(word.endTime) &&
          word.endTime > word.startTime
      );
      return words.length > 1 && words.some((word) => word.startTime !== words[0]!.startTime);
    });
  }

  hasSpecialEffects(): boolean {
    const lines = this.data.filter(
      (line) => !line.isBlank && line.words.some((word) => word.word.trim())
    );
    if (this.hasWordTiming() || lines.some((line) => line.isDuet)) return true;
    const timed = lines
      .filter(
        (line) =>
          Number.isFinite(line.startTime) &&
          Number.isFinite(line.endTime) &&
          line.endTime > line.startTime &&
          line.endTime < 59_999_999
      )
      .toSorted((a, b) => a.startTime - b.startTime);
    let previousEnd = -Infinity;
    for (const line of timed) {
      if (Math.min(previousEnd, line.endTime) - line.startTime > 50) return true;
      previousEnd = Math.max(previousEnd, line.endTime);
    }
    return false;
  }

  static fromNeteaseAPIResponse(response: NeteaseAPI.NeteaseLyricResponse): NeteaseLyric {
    return new NeteaseLyric(Parser.parseNeteaseLyricResponse(response));
  }

  static fromTTMLyric(lyric: string, isLocalTTML: boolean): NeteaseLyric {
    return new NeteaseLyric(Parser.parseTTMLyric(lyric, isLocalTTML).lyric);
  }

  static fromObject(lyric: Optional<NeteaseLyricModel>): Nullable<NeteaseLyric> {
    if (!lyric) return null;
    return new NeteaseLyric(lyric);
  }

  static get blankLyric(): NeteaseLyric {
    return new NeteaseLyric(RendererLyricConstants.noLyricPreset);
  }

  static get pureMusicLyric(): NeteaseLyric {
    return new NeteaseLyric(RendererLyricConstants.pureMusicLyricPreset);
  }

  static get loadErrorLyric(): NeteaseLyric {
    return new NeteaseLyric(RendererLyricConstants.loadErrorLyricPreset);
  }
}

class Parser {
  static parseTranslatedLRC(content: string): LyricLine[] {
    const raw = parseLrc(content);
    return parseTranslatedLRC(raw, false) as LyricLine[];
  }

  static parseExternalLrc(lyric: string): LyricLine[] {
    // eg: [00:00.00-1] 作曲 : solfa \n
    lyric = parseExternalLrc(lyric);
    return parseLrc(lyric);
  }

  static parseTTMLyric(context: string, isLocalTTML: boolean) {
    const raw = TTMLParser.parse(context);
    const converted = toAmllLyrics(raw);
    // 库的 AMLL 便捷模型只有单一 translatedLyric。沿用库的分词、和声展开和
    // 对唱转换，仅把完整解析结果里的翻译附回对应的主唱/和声行。
    const sources = raw.lines.flatMap((line) =>
      line.backgroundVocal ? [line, line.backgroundVocal] : [line]
    );
    const ttml = Parser.handleTTMLSpaceWord({
      ...converted,
      lines: converted.lines.map((line, index) => {
        const translations = sources[index]?.translations?.map((translation) => ({
          ...translation,
          words: translation.words?.map((word) => ({
            word: word.text + (word.endsWithSpace ? " " : ""),
            startTime: word.startTime,
            endTime: word.endTime
          }))
        }));
        const preferred = preferredLyricLanguage(
          translations
            ?.filter((translation) => translation.text.trim())
            .map((translation) => translation.language || "und") ?? []
        );
        return {
          ...line,
          ...(translations?.length
            ? {
                translations,
                translatedLyric:
                  translations.find((translation) => (translation.language || "und") === preferred)
                    ?.text ?? line.translatedLyric
              }
            : {})
        };
      })
    });

    /**
     * @deprecated 仅为兼容历史脏数据保留，新代码不要再依赖它。
     *
     * 该修复是 `@applemusic-like-lyrics/lyric` 0.3.0（WASM 解析器）时代的兜底：
     * 当时和声组 `<span ttm:role="x-bg">` 不带 begin/end，整行会被解析成从 0 秒开始。
     *
     * 升级到 1.1.0（底层换成 `@applemusic-like-lyrics/ttml`，纯 JS）后问题已在解析层根治：
     * x-bg 组取子 span 的 min begin / max end，行起始也对齐到首词。
     * 实测 24 个文件 / 1376 行经此函数零改动，属于幂等空操作。
     *
     * 保留原因：挡住第三方人工编辑的 TTML（整行写成 0 秒、endTime 早于 startTime 之类）。
     * 已知副作用：首词时长超过 max(8s, 同行中位数×4) 时会被回推成 `endTime - 中位数`，
     * 极端长音可能被截断；需要收窄时改 `packages/wasm/src/lyric/normalize.rs`
     * 的 `WORD_DURATION_ANOMALY_MIN_MS`。
     *
     * 全项目仅此一处调用，QQ/LRC/YRC 等解析路径都不经过它。
     */
    const normalized = normalizeLyricLines(ttml.lines) as AMLyricLine[];
    // 规范化只负责时间修复；保留库提供的扩展信息，避免 JS -> Rust -> JS 丢字段。
    const lines = ttml.lines.map((line, index) => ({
      ...line,
      ...normalized[index],
      words: line.words.map((word, wordIndex) => ({
        ...word,
        ...normalized[index]?.words[wordIndex]
      }))
    }));
    const data = Parser.handleAMLyricLine(lines);
    const { rmCount, tlCount, noteCount } = data.reduce(
      (count, line) => {
        line.translatedLyric && count.tlCount++;
        line.romanLyric && count.rmCount++;
        line.words.some((word) => word.inlineNote) && count.noteCount++;
        return count;
      },
      { tlCount: 0, rmCount: 0, noteCount: 0 }
    );
    const lyricLineCount = data.filter((line) => !line.isBlank).length;

    return {
      lyric: <NeteaseLyricModel>{
        data,
        isLocalTTML,
        rmExisted: Parser.hasExtraLyric(rmCount, lyricLineCount),
        tlExisted: Parser.hasExtraLyric(tlCount, lyricLineCount),
        noteExisted: noteCount > 0,
        tips: data.length >= 5 ? (isLocalTTML ? localTTMLTips : "歌词来源：AppleMusic") : undefined
      },
      metadata: ttml.metadata
    };
  }

  static handleTTMLSpaceWord(ttml: TTMLLyric): TTMLLyric {
    const lines = ttml.lines;

    for (const line of lines) {
      line.words = line.words.map((w, i) => {
        const last = line.words[i - 1];
        const next = line.words[i + 1];
        if (w.word.trim() === "" && (w.startTime === 0 || w.endTime === 0)) {
          w.startTime = last ? last.endTime : line.startTime;
          w.endTime = next ? next.startTime : line.endTime;
        }
        return w;
      });
    }

    return ttml;
  }

  static handleAMLyricLine(lines: AMLyricLine[]): LyricLine[] {
    const rawLyrics: string[] = [];
    const res: LyricLine[] = lines.map((line) => {
      const rawLyric = line.words.map((w) => w.word).join("");
      rawLyrics.push(rawLyric);
      return {
        ...line,
        isBG: line.isBG ?? false,
        isDuet: line.isDuet ?? false,
        isBlank: LyricLineInfo.isBlank(rawLyric),
        isBackChorus: line.isBG || line.isDuet || LyricLineInfo.isBackChorus(rawLyric)
      };
    });
    const backChorus = LyricLineInfo.isBackChorusWithMultiLine(rawLyrics);

    for (const { end, start } of backChorus) {
      for (let i = start; i <= end && i < res.length; i++) {
        res[i]!.isBackChorus = true;
      }
    }

    const inlineNotes = res.map((line) =>
      LyricLineInfo.isInlineNote(line.words.map((w) => w.word))
    );
    if (Parser.shouldUseInlineNotes(rawLyrics, inlineNotes)) {
      for (const [lineIndex, line] of res.entries()) {
        const notes = inlineNotes[lineIndex] ?? [];
        for (const { end, start } of notes) {
          for (let i = start; i <= end && i < line.words.length; i++) {
            line.words[i]!.inlineNote = true;
          }
        }
      }
    }

    return res;
  }

  static shouldUseInlineNotes(
    rawLyrics: string[],
    inlineNotes: { end: number; start: number }[][]
  ): boolean {
    const lineCount = rawLyrics.filter((line) => !LyricLineInfo.isBlank(line)).length;
    const candidateLineCount = inlineNotes.filter((notes) => notes.length > 0).length;
    const candidateCount = inlineNotes.reduce((count, notes) => count + notes.length, 0);

    if (lineCount <= 3) {
      return lineCount > 0 && candidateLineCount === lineCount && candidateCount >= 2;
    }

    return candidateLineCount >= 3 && candidateLineCount * 2 >= lineCount;
  }

  static hasExtraLyric(count: number, total: number) {
    return count > 0 && count * 2 >= Math.max(total, 1);
  }

  /** 处理和解析歌词响应 */
  static parseNeteaseLyricResponse(
    response: NeteaseAPI.NeteaseLyricResponseNew
  ): NeteaseLyricModel {
    if (!response?.lrc?.lyric && !response?.yrc)
      // 没有任何歌词
      return RendererLyricConstants.noLyricPreset;

    let parsedLyric;
    const LRC = response.lrc;
    const LRCTranslated = response.tlyric;
    const LRCRoman = response.romalrc;

    const YRC = response.yrc;
    const YRCTranslated = response.ytlrc;
    const YRCRoman = response.yromalrc;

    const meta = response.transUser;
    const { text, embeds } = Parser.extractNeteaseEmbeds(LRC?.lyric || "");
    const cleanLRC = LRC ? { ...LRC, lyric: text } : undefined;
    if (YRC && YRC.lyric) {
      parsedLyric = Parser.parseNeteaseLyric(YRC, YRCTranslated, YRCRoman, "YRC", meta);
      // fallback
      if (parsedLyric && !parsedLyric.rmExisted && cleanLRC?.lyric && LRCRoman?.lyric) {
        const lineLevel = Parser.parseNeteaseLyric(cleanLRC, LRCTranslated, LRCRoman, "LRC", meta);
        if (lineLevel?.rmExisted) {
          if (new NeteaseLyric(parsedLyric).hasWordTiming()) {
            parsedLyric = Parser.parseNeteaseLyric(
              YRC,
              YRCTranslated?.lyric ? YRCTranslated : LRCTranslated,
              LRCRoman,
              "YRC",
              meta
            );
          } else parsedLyric = lineLevel;
        }
      }
    } else if (cleanLRC?.lyric) {
      parsedLyric = Parser.parseNeteaseLyric(cleanLRC, LRCTranslated, LRCRoman, "LRC", meta);
    }

    if (!parsedLyric) {
      return { ...RendererLyricConstants.noLyricPreset, ...(embeds.length ? { embeds } : {}) };
    } else if (parsedLyric.data.length === 0) {
      return {
        ...RendererLyricConstants.pureMusicLyricPreset,
        ...(embeds.length ? { embeds } : {})
      };
    } else {
      return {
        ...parsedLyric,
        ...(embeds.length ? { embeds } : {}),
        tips: parsedLyric.tips || parsedLyric.data.length >= 5 ? "歌词来源：网易云音乐" : undefined
      };
    }
  }

  static extractNeteaseEmbeds(content: string): { text: string; embeds: LyricEmbed[] } {
    const embeds: LyricEmbed[] = [];
    const text = content
      .split(/\r?\n/)
      .filter((line, position) => {
        if (!line.trimStart().startsWith("{")) return true;
        try {
          const record = LyricEmbedSchema.safeParse({ ...JSON.parse(line), position });
          if (!record.success) return true;
          embeds.push(record.data);
          return false;
        } catch {
          return true;
        }
      })
      .join("\n");
    return { text, embeds };
  }

  static parseNeteaseLyric(
    raw: NeteaseAPI.NeteaseLyric,
    ts: Undefinable<NeteaseAPI.NeteaseLyric>,
    rm: Undefinable<NeteaseAPI.NeteaseLyric>,
    type: "LRC" | "QRC" | "YRC",
    mt?: NeteaseAPI.NeteaseTransUser
  ): NeteaseLyricModel {
    try {
      let mainLyric;
      switch (type) {
        case "YRC":
          mainLyric = parseYrc(raw.lyric);
          break;
        case "QRC":
          mainLyric = parseQrc(raw.lyric);
          break;
        case "LRC":
          mainLyric = Parser.parseExternalLrc(raw.lyric);
      }
      const translatedLyric = Parser.parseExternalLrc(ts?.lyric || "");
      const romanLyric = Parser.parseExternalLrc(rm?.lyric || "");

      return {
        ...(parseNeteaseLyric(mainLyric, translatedLyric, romanLyric) as NeteaseLyricModel),
        tips: mt?.nickname ? `歌词贡献者：${mt.nickname}` : ""
      };
    } catch (err) {
      Log.error({
        label: "parseNeteaseLyric",
        message: "parseNeteaseLyric failed",
        raw: err
      });
      return <NeteaseLyricModel>{
        data: [],
        rmExisted: false,
        tlExisted: false,
        noteExisted: false
      };
    }
  }
}
