import { decryptQrc } from "qrc-decoder";
import { EqError } from "@mahiru/log";
import { Log } from "@/common/lib/log";
import { RendererNet } from "@/common/lib/net";
import { NeteaseTrack } from "@/common/netease/models";

import { scoreSong } from "./match";
import { textToBase64, requestMusicuFcg } from "./utils";
import type {
  QQSong,
  QQSongMatch,
  QQLyricResult,
  QQLyricContent,
  QQLyricResponse,
  QQSearchResponse,
  QQLegacySearchResponse
} from "./model";

export class QQMusicLyric {
  /**
   * 现代 QQ 搜索接口
   */
  private static async search_modern(keyword: string, limit = 10): Promise<QQSong[]> {
    // music.search.SearchCgiService 这里最好：
    //  1. 顶层 key 就叫 module 名
    //  2. 不携带通用 comm
    const module = "music.search.SearchCgiService";
    const json = await requestMusicuFcg<QQSearchResponse>({
      [module]: {
        module,
        method: "DoSearchForQQMusicDesktop",
        param: {
          search_type: 0,
          query: keyword,
          page_num: 1,
          num_per_page: limit
        }
      }
    });

    const block = json[module];
    if (json.code !== 0 || !block || block.code !== 0) {
      throw new EqError(`QQ search failed, code ${block?.code ?? null}`);
    }

    return block.data?.body?.song?.list ?? [];
  }

  /**
   * 老 Web 搜索接口
   *
   * musicu 搜索在境外 IP 返回空结果
   */
  private static async search_fallback(keyword: string, limit = 10): Promise<QQSong[]> {
    const url = new URL("https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp");

    url.searchParams.set("w", keyword);
    url.searchParams.set("p", "1");
    url.searchParams.set("n", String(limit));
    url.searchParams.set("format", "json");
    url.searchParams.set("t", "0");
    url.searchParams.set("platform", "yqq");
    url.searchParams.set("needNewCode", "1");

    const res = await RendererNet.requestFromNode(url, {
      headers: {
        Referer: "https://y.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36"
      }
    });

    if (!res.ok) throw new Error(`QQ fallback search HTTP ${res.status}`);

    const json: QQLegacySearchResponse = await res.json();
    if (json.code !== 0) throw new Error(`QQ fallback search failed: ${JSON.stringify(json)}`);

    return (json.data?.song?.list ?? []).map((song) => ({
      id: song.songid,
      mid: song.songmid,
      title: song.songname,
      interval: song.interval,
      singer: song.singer,
      album: {
        id: song.albumid,
        mid: song.albummid,
        name: song.albumname
      }
    }));
  }

  /**
   * QQ QRC 数据解密
   *
   * crypt=1 返回的通常是 hex
   */
  private static decode_qrc(value: unknown): string {
    if (typeof value !== "string" || !value) return "";

    const text = value.trim();
    // QRC 密文正常是 hex
    if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
      try {
        return decryptQrc(text);
      } catch (err) {
        Log.warn("qq-music-decode-qrc", "decrypt failed:", err);
      }
    }

    // 防止接口某些情况下直接给明文
    return text;
  }

  private static decode_lyric(value: unknown): null | QQLyricContent {
    const text = this.decode_qrc(value).trim();
    if (!text) return null;

    // 用解密后的时间标记识别格式；qrc=1 不代表翻译、罗马音也都是 QRC。
    // 同时兼容 XML 包装的 QRC 和去掉包装后的逐字内容。
    if (/\[\d+,\d+][^\r\n]*\(\d+,\d+\)/.test(text)) {
      return { type: "qrc", text };
    }
    // 当前 AMLL parseLrc 要求秒后带小数；不支持的时间格式保留为 unknown。
    if (/(?:^|[\r\n])\s*\[\d+:\d{2}[.:]\d{1,3}]/.test(text)) {
      return { type: "lrc", text };
    }
    // 包括不带时间轴的文本，以及解密失败后保留的密文。
    return { type: "unknown", text };
  }

  /**
   * QQ 音乐搜索接口
   * */
  static async search(keyword: string, limit = 10): Promise<QQSong[]> {
    try {
      const songs = await this.search_modern(keyword, limit);
      if (songs.length > 0) return songs;
      Log.warn("qq-music-search", "modern API returned empty, fallback...");
    } catch (err) {
      Log.warn("qq-music-search", "modern API failed:", err);
    }
    return this.search_fallback(keyword, limit).catch((err) => {
      Log.warn("qq-music-search", "fallback API failed:", err);
      return [];
    });
  }

  /**
   * QQ 音乐歌词接口
   */
  static async get(song: QQSong): Promise<QQLyricResult> {
    const singerName = song.singer
      ?.map((item) => item.name)
      .filter(Boolean)
      .join("/");

    const albumName = song.album?.name ?? "";
    const json = await requestMusicuFcg<QQLyricResponse>({
      comm: {
        ct: 24,
        cv: 0,
        uin: "0",
        format: "json"
      },
      lyric: {
        module: "music.musichallSong.PlayLyricInfo",
        method: "GetPlayLyricInfo",
        param: {
          // 两个都带上
          songID: song.id,
          songMID: song.mid,
          // 请求加密 QRC
          crypt: 1,
          // 普通 / 逐字歌词
          lrc_t: 0,
          qrc: 1,
          qrc_t: 0,
          // 翻译
          trans: 1,
          trans_t: 0,
          // 罗马音
          roma: 1,
          roma_t: 0,
          // 下面这些不是最小必需参数，
          // 但当前第三方实现经常一起提供
          ct: 19,
          cv: 2111,
          interval: song.interval ?? 0,
          songName: textToBase64(song.title ?? ""),
          singerName: textToBase64(singerName ?? ""),
          albumName: textToBase64(albumName),
          type: 0
        }
      }
    });

    const block = json.lyric;
    if (json.code !== 0 || !block || block.code !== 0 || !block.data) {
      throw new Error(`GetPlayLyricInfo failed: ${JSON.stringify(block ?? json)}`);
    }

    const data = block.data;
    return {
      raw: data,
      lyric: this.decode_lyric(data.lyric),
      translation: this.decode_lyric(data.trans),
      roma: this.decode_lyric(data.roma)
    };
  }

  /** 从 QQ 搜索结果中选出与网易云曲目最可能对应的歌曲 */
  static match(track: NeteaseTrack, songs: QQSong[]): Nullable<QQSongMatch> {
    const best = songs
      .map((song) => ({ song, score: scoreSong(track, song) }))
      .sort((a, b) => b.score - a.score)[0];

    return best && best.score >= 70 ? best : null;
  }
}
