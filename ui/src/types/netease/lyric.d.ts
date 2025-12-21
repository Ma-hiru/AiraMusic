interface NeteaseLyricResponse extends NeteaseAPIResponse {
  /** 逐字歌词 QRC （逐字格式）*/
  klyric?: NeteaseKlyric;
  /** 主歌词 LRC */
  lrc?: NeteaseLrc;
  /** 罗马音歌词 LRC（罗马拼音）*/
  romalrc?: NeteaseRomalrc;
  /** 歌词同步、翻译质量相关标志 */
  qfy: boolean;
  /** 歌词同步、翻译质量相关标志 */
  sfy: boolean;
  /** 歌词同步、翻译质量相关标志 */
  sgc: boolean;
  /** 翻译歌词 LRC（翻译版）*/
  tlyric?: NeteaseTlyric;
  /** 提供歌词/翻译的用户信息 */
  transUser: NeteaseTransUser;
}

interface NeteaseKlyric {
  lyric: string;
  version: number;
}

interface NeteaseLrc {
  lyric: string;
  version: number;
}

interface NeteaseRomalrc {
  lyric: string;
  version: number;
}

interface NeteaseTlyric {
  lyric: string;
  version: number;
}

interface NeteaseYRC {
  lyric: string;
  version: number;
}

interface NeteaseTransUser {
  demand: number;
  id: number;
  nickname: string;
  status: number;
  uptime: number;
  userid: number;
}

interface NeteaseLyricResponseNew extends NeteaseLyricResponse {
  yrc?: NeteaseYRC;
  ytlrc?: NeteaseTlyric;
  yromalrc?: NeteaseRomalrc;
}
