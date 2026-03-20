import { parseLrc, parseQrc, parseTTML, parseYrc } from "@applemusic-like-lyrics/lyric";
import { parseExternalLrc, parseNeteaseLyric, parseTranslatedLRC } from "@mahiru/wasm";
import { Errs } from "@mahiru/ui/public/entry/errs";
import {
  loadErrorLyricPreset,
  noLyricPreset,
  pureMusicLyricPreset
} from "@mahiru/ui/public/constants/lyric";
import { Log } from "@mahiru/ui/public/utils/dev";

export class NeteaseLyric implements FullVersionLyricLine {
  //region fields
  readonly full: LyricLine[];
  readonly raw: LyricLine[];
  readonly rm: LyricLine[];
  readonly tl: LyricLine[];
  currentVersion: LyricVersionType = "tl";

  constructor(props: FullVersionLyricLine) {
    this.full = props.full;
    this.raw = props.raw;
    this.rm = props.rm;
    this.tl = props.tl;
  }
  //endregion

  /** 根据歌词数据，将相应版本映射成布尔值 */
  versionInfo() {
    return {
      hasRm: this.rm.length > 0,
      hasTl: this.tl.length > 0,
      hasFull: this.full.length > 0,
      hasRaw: this.raw.length > 0,
      rmActive: this.currentVersion === "rm" || this.currentVersion === "full",
      tlActive: this.currentVersion === "tl" || this.currentVersion === "full",
      allActive: this.currentVersion === "full"
    };
  }

  /** 歌词版本切换检查 */
  versionChange(next: Optional<LyricVersionType>) {
    if (!next) return;

    const { hasRm, hasFull, hasTl, hasRaw } = this.versionInfo();
    if (
      (next === "rm" && hasRm) ||
      (next === "tl" && hasTl) ||
      (next === "full" && hasFull) ||
      (next === "raw" && hasRaw)
    ) {
      this.currentVersion = next;
    }
  }

  versionFSM(next: LyricVersionType): LyricVersionType {
    const { rmActive, tlActive, allActive, hasRaw } = this.versionInfo();
    const active = () => {
      if (next === "raw" && hasRaw) return true;
      if (next === "full" && allActive) return true;
      if (next === "rm" && rmActive) return true;
      if (next === "tl" && tlActive) return true;
    };
    if (!active()) {
      switch (this.currentVersion) {
        case "full":
          break;
        case "raw":
          return next;
        case "rm":
          if (next === "tl" || next === "full") return "full";
          break;
        case "tl":
          if (next === "rm" || next === "full") return "full";
      }
    } else {
      switch (this.currentVersion) {
        case "full":
          if (next === "rm") return "tl";
          if (next === "tl") return "rm";
          if (next === "full") return "raw";
          break;
        case "raw":
          break;
        case "rm":
          if (next === "rm" || next === "full") return "raw";
          break;
        case "tl":
          if (next === "tl" || next === "full") return "raw";
      }
    }
    return this.currentVersion;
  }

  /** 歌词版本选择，结合偏好和现有歌词，选出最合适的歌词版本，没有偏好默认显示翻译 */
  versionChangeWithPreference(preference: Optional<LyricVersionType>) {
    const { hasRm, hasTl } = this.versionInfo();
    if (!preference) {
      if (hasTl) return (this.currentVersion = "tl");
      if (hasRm) return (this.currentVersion = "rm");
      return (this.currentVersion = "raw");
    }
    if (preference === "raw" && hasTl) return (this.currentVersion = "tl");
    if (preference === "full") {
      if (!hasRm && !hasTl) return (this.currentVersion = "raw");
      else if (!hasRm && hasTl) return (this.currentVersion = "tl");
      else if (hasRm && !hasTl) return (this.currentVersion = "rm");
    }
    if (preference === "rm" && !hasRm) {
      if (hasTl) return (this.currentVersion = "tl");
      else return (this.currentVersion = "raw");
    }
    if (preference === "tl" && !hasTl) {
      if (hasRm) return (this.currentVersion = "rm");
      else return (this.currentVersion = "raw");
    }
    return (this.currentVersion = preference);
  }

  static fromNeteaseAPIResponse(response: NeteaseAPI.NeteaseLyricResponse) {
    return new NeteaseLyric(Parser.parseNeteaseLyricResponse(response));
  }

  static fromTTMLyric(lyric: string) {
    return new NeteaseLyric(Parser.parseTTMLyric(lyric).lyric);
  }

  static fromObject(lyric: Optional<NeteaseLyric>) {
    if (!lyric) return null;
    return new NeteaseLyric(lyric);
  }

  static get blankLyric() {
    return new NeteaseLyric(noLyricPreset);
  }

  static get pureMusicLyric() {
    return new NeteaseLyric(pureMusicLyricPreset);
  }

  static get loadErrorLyric() {
    return new NeteaseLyric(loadErrorLyricPreset);
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
    return {
      lyric: {
        raw: ttml.lines,
        tl: [],
        rm: [],
        full: []
      } satisfies FullVersionLyricLine,
      metadata: ttml.metadata
    };
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
      const meta = <NeteaseAPI.NeteaseTransUser>{
        nickname: mt?.nickname || ""
      };

      return parseNeteaseLyric(
        mainLyric || [],
        translatedLyric || [],
        romanLyric || [],
        meta
      ) as FullVersionLyricLine;
    } catch (err) {
      Log.error(Errs.LyricParseErr.create("parseNeteaseLyric", err));
      return {
        full: [],
        raw: [],
        tl: [],
        rm: []
      } as FullVersionLyricLine;
    }
  }

  /** 处理和解析歌词响应 */
  static parseNeteaseLyricResponse(
    response: NeteaseAPI.NeteaseLyricResponseNew
  ): FullVersionLyricLine {
    if (!response?.lrc?.lyric && !response?.yrc)
      // 没有任何歌词
      return noLyricPreset;

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
    } else if (LRC && LRC.lyric) {
      parsedLyric = Parser.parseNeteaseLyric(LRC, LRCTranslated, LRCRoman, "LRC", meta);
    }

    if (!parsedLyric) {
      return noLyricPreset;
    } else if (parsedLyric.raw.length === 0) {
      return pureMusicLyricPreset;
    } else {
      return parsedLyric;
    }
  }
}
