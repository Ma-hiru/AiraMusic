/**
 * 音质等级对应的码率
 */
export const enum TrackQuality {
  l = 128000,
  m = 192000,
  h = 320000,
  sq = 990000,
  hr = 9990000
}

/**
 * 歌曲Bitmark枚举
 */
export const enum TrackBitmark {
  Stereo = 8192,
  PureMusic = 131072,
  DolbyAtmos = 262144,
  Explicit = 1048576,
  HiRes = 17179869184
}

export const enum NeteaseMusicLevel {
  /**标准 */
  standard = "standard",
  /** 较高 */
  higher = "higher",
  /**极高 */
  exhigh = "exhigh",
  /** 无损 */
  lossless = "lossless",
  /** Hi-Res */
  hires = "hires",
  /** 高清环绕声 */
  jyeffect = "jyeffect",
  /** 沉浸环绕声 */
  sky = "sky",
  /** 杜比全景声 */
  dolby = "dolby",
  /** 超清母带 */
  jymaster = "jymaster"
}
