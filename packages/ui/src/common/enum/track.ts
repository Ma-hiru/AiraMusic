/**
 * 音质等级对应的码率
 */
export const enum TrackQuality {
  l = "128K",
  m = "192K",
  h = "320K",
  sq = "SQ",
  hr = "Hi-Res"
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
