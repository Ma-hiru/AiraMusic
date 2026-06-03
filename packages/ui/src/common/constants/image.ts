import { NeteaseImageSize } from "@/common/enum";

export default class RendererImageConstants {
  static readonly TopAvatarSize = NeteaseImageSize.md;
  static readonly TopMiniAvatarSize = NeteaseImageSize.sm;
  static readonly PlaylistPageCoverSize = NeteaseImageSize.md;
  static readonly AlbumPageCoverSize = NeteaseImageSize.md;
  static readonly AlbumListCoverSize = 200;
  static readonly PlaylistPageCreatorAvatarSize = NeteaseImageSize.sm;
  static readonly NavPlaylistCoverSize = NeteaseImageSize.xs;
  static readonly PlaylistPageTrackCoverSize = NeteaseImageSize.xs;
  static readonly HomePagePlaylistCoverSize = 180;
  static readonly HomePageTrackCoverSize = 180;
  static readonly IgnoredCacheId = 3136952023; // 私人雷达
}
