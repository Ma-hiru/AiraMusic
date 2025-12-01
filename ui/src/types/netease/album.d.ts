/**
 * 嵌入在歌曲数据中的专辑简介。
 */
interface Al {
  id: number;
  name: string;
  pic: number;
  pic_str?: string;
  picUrl: string;
  /** 注入字段 */
  cachedPicUrl: string;
  /** 注入字段 */
  cachedPicUrlID: string;
  tns: string[];
}
