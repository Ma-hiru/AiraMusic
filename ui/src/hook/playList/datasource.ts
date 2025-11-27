import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import {
  NeteaseImageSizeFilter,
  NeteaseTrackStatusFilter,
  NeteaseTrackIDsToTrackFilter
} from "@mahiru/ui/utils/filter";
import { Store } from "@mahiru/ui/utils/cache";

/**
 * PlaylistDataSource
 * 负责：
 *  - 将传入 ids 分批请求（避免 URL 长度限制）
 *  - 对返回的 tracks 做 NeteaseTrackFilter
 *  - 调用 Store.checkOrStoreAsyncMutil 替换已缓存封面
 */
export class PlayListDataSource {
  constructor(private maxPerRequest = 100) {}
  /**
   * 分批请求，避免 URL 超长限制，并顺便处理封面缓存。
   */

}
