import { z } from "zod";
import {
  parseLrc,
  parseQrc,
  parseYrc,
  parseTTML,
  type LyricLine as AMLyricLine
} from "@applemusic-like-lyrics/lyric";
import { Log } from "@/common/lib/log";
import { RendererLyricConstants } from "@/common/constants/lyric";
import {
  LyricLineInfo,
  parseExternalLrc,
  parseNeteaseLyric,
  parseTranslatedLRC,
  normalizeLyricLines
} from "@mahiru/wasm";

export const NeteaseLyricSchema = z.object({
  id: z.number().optional(),
  tips: z.string().optional(),
  data: z.array(
    z.object({
      words: z
        .array(
          z.object({
            startTime: z.number().describe("单词的起始时间，单位为毫秒"),
            endTime: z.number().describe("单词的结束时间，单位为毫秒"),
            word: z.string().describe("单词内容"),
            inlineNote: z
              .boolean()
              .optional()
              .describe("是否为内嵌注释，比如日文汉字的平假名和片假名")
          })
        )
        .describe("该行的所有单词"),
      translatedLyric: z.string().describe("该行的翻译歌词，将会显示在主歌词行的下方"),
      romanLyric: z.string().describe("该行的音译歌词，将会显示在翻译歌词行的下方"),
      startTime: z.number().describe("该行的起始时间，单位为毫秒"),
      endTime: z.number().describe("该行的结束时间，单位为毫秒"),
      isBlank: z.boolean().optional().describe("是否为空白行"),
      isBackChorus: z.boolean().optional().describe("是否为和声行")
    })
  ),
  rmExisted: z.boolean(),
  tlExisted: z.boolean(),
  noteExisted: z.boolean()
});

export class NeteaseLyric implements NeteaseLyricModel {
  //region fields
  readonly data;
  readonly tips;
  readonly rmExisted;
  readonly tlExisted;
  readonly noteExisted;
  readonly id;

  constructor(props: Partial<NeteaseLyricModel>) {
    this.data = props.data || [];
    this.rmExisted = props.rmExisted || false;
    this.tlExisted = props.tlExisted || false;
    this.noteExisted = props.noteExisted || false;
    this.tips = props.tips || "";
    this.id = props.id;
  }
  //endregion

  get key() {
    return `${this.id || 0}_${this.tips}_${this.data?.length || 0}_${this.rmExisted}_${this.tlExisted}`;
  }

  get info() {
    return {
      rmExisted: this.rmExisted,
      tlExisted: this.tlExisted,
      noteExisted: this.noteExisted,
      lineCount: this.data.length,
      tips: this.tips
    };
  }

  /** @deprecated Agent 输出请统一使用 RendererTool.lyric。 */
  toToolJSONValue(): JsonValue {
    return {
      data: this.data as unknown as JsonValue[],
      tips: this.tips,
      rmExisted: this.rmExisted,
      tlExisted: this.tlExisted,
      noteExisted: this.noteExisted,
      id: this.id ?? null
    };
  }

  static fromNeteaseAPIResponse(response: NeteaseAPI.NeteaseLyricResponse) {
    return new NeteaseLyric(Parser.parseNeteaseLyricResponse(response));
  }

  static fromTTMLyric(lyric: string) {
    return new NeteaseLyric(Parser.parseTTMLyric(lyric).lyric);
  }

  static fromObject(lyric: Optional<NeteaseLyricModel>) {
    if (!lyric) return null;
    return new NeteaseLyric(lyric);
  }

  static get blankLyric() {
    return new NeteaseLyric(RendererLyricConstants.noLyricPreset);
  }

  static get pureMusicLyric() {
    return new NeteaseLyric(RendererLyricConstants.pureMusicLyricPreset);
  }

  static get loadErrorLyric() {
    return new NeteaseLyric(RendererLyricConstants.loadErrorLyricPreset);
  }
}

class Parser {
  static parseTranslatedLRC(content: string): LyricLine[] {
    const raw = parseLrc(content);
    return parseTranslatedLRC(raw, false) as LyricLine[];
  }

  static parseExternalLrc(lyric: string) {
    // eg: [00:00.00-1] 作曲 : solfa \n
    lyric = parseExternalLrc(lyric);
    return parseLrc(lyric);
  }

  static parseTTMLyric(context: string) {
    const ttml = parseTTML(context);
    // TTML 文件先修复
    const lines = normalizeLyricLines(ttml.lines) as AMLyricLine[];
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
        rmExisted: Parser.hasExtraLyric(rmCount, lyricLineCount),
        tlExisted: Parser.hasExtraLyric(tlCount, lyricLineCount),
        noteExisted: noteCount > 0
      },
      metadata: ttml.metadata
    };
  }

  static handleAMLyricLine(lines: AMLyricLine[]): LyricLine[] {
    const rawLyrics: string[] = [];
    const res: LyricLine[] = lines.map((line) => {
      const rawLyric = line.words.map((w) => w.word).join("");
      rawLyrics.push(rawLyric);
      return {
        ...line,
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
  ) {
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
    if (YRC && YRC.lyric) {
      parsedLyric = Parser.parseNeteaseLyric(YRC, YRCTranslated, YRCRoman, "YRC", meta);
      // fallback
      if (parsedLyric && !parsedLyric.rmExisted && LRC?.lyric && LRCRoman?.lyric) {
        const lineLevel = Parser.parseNeteaseLyric(LRC, LRCTranslated, LRCRoman, "LRC", meta);
        if (lineLevel?.rmExisted) {
          parsedLyric = lineLevel;
        }
      }
    } else if (LRC && LRC.lyric) {
      parsedLyric = Parser.parseNeteaseLyric(LRC, LRCTranslated, LRCRoman, "LRC", meta);
    }

    if (!parsedLyric) {
      return RendererLyricConstants.noLyricPreset;
    } else if (parsedLyric.data.length === 0) {
      return RendererLyricConstants.pureMusicLyricPreset;
    } else {
      return parsedLyric;
    }
  }

  static parseNeteaseLyric(
    raw: NeteaseAPI.NeteaseLyric,
    ts: Undefinable<NeteaseAPI.NeteaseLyric>,
    rm: Undefinable<NeteaseAPI.NeteaseLyric>,
    type: "LRC" | "QRC" | "YRC",
    mt?: NeteaseAPI.NeteaseTransUser
  ) {
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
