import { parseLrc, parseQrc, parseTTML, parseYrc } from "@applemusic-like-lyrics/lyric";
import { parseExternalLrc, parseNeteaseLyric, parseTranslatedLRC } from "@mahiru/wasm";
import { Errs } from "@mahiru/ui/public/entry/errs";
import {
  loadErrorLyricPreset,
  noLyricPreset,
  pureMusicLyricPreset
} from "@mahiru/ui/public/constants/lyric";
import { Log } from "@mahiru/ui/public/utils/dev";

export class NeteaseLyric implements NeteaseLyricModel {
  //region fields
  readonly data;
  readonly tips;
  readonly rmExisted;
  readonly tlExisted;
  rmActive;
  tlActive;

  constructor(props: NeteaseLyricModel) {
    this.data = props.data;
    this.rmExisted = props.rmExisted;
    this.tlExisted = props.tlExisted;
    this.tips = props.tips || "";
    this.tlActive = props.tlActive || false;
    this.rmActive = props.rmActive || false;
  }
  //endregion

  toggleRm() {
    this.rmExisted && (this.rmActive = !this.rmActive);
  }

  toggleTl() {
    this.tlExisted && (this.tlActive = !this.tlActive);
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
    const { tlCount, rmCount } = ttml.lines.reduce(
      (count, line) => {
        line.translatedLyric && count.tlCount++;
        line.romanLyric && count.rmCount++;
        return count;
      },
      { tlCount: 0, rmCount: 0 }
    );
    return {
      lyric: <NeteaseLyricModel>{
        data: ttml.lines,
        rmExisted: tlCount > ttml.lines.length / 2,
        tlExisted: rmCount > ttml.lines.length / 2
      },
      metadata: ttml.metadata
    };
  }

  /** 处理和解析歌词响应 */
  static parseNeteaseLyricResponse(
    response: NeteaseAPI.NeteaseLyricResponseNew
  ): NeteaseLyricModel {
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
    } else if (parsedLyric.data.length === 0) {
      return pureMusicLyricPreset;
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
        tips: mt?.nickname
      };
    } catch (err) {
      Log.error(Errs.LyricParseErr.create("parseNeteaseLyric", err));
      return <NeteaseLyricModel>{
        data: [],
        rmExisted: false,
        tlExisted: false
      };
    }
  }
}
