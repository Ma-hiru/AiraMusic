import _NeteaseImageSource from "@mahiru/ui/public/source/netease/services/image";
import _NeteaseLyricSource from "@mahiru/ui/public/source/netease/services/lyric";
import _NeteaseTrackSource from "@mahiru/ui/public/source/netease/services/track";
import _NeteasePlaylistSource from "@mahiru/ui/public/source/netease/services/playlist";
import _NeteaseCommentSource from "@mahiru/ui/public/source/netease/services/comment";
import _NeteaseAudioSource from "@mahiru/ui/public/source/netease/services/audio";
import _NeteaseUserSource from "@mahiru/ui/public/source/netease/services/user";
import _NeteaseAuth from "@mahiru/ui/public/source/netease/services/auth";

export default class NeteaseServices {
  static readonly Audio = _NeteaseAudioSource;
  static readonly Comment = _NeteaseCommentSource;
  static readonly Image = _NeteaseImageSource;
  static readonly Lyric = _NeteaseLyricSource;
  static readonly Playlist = _NeteasePlaylistSource;
  static readonly Track = _NeteaseTrackSource;
  static readonly User = _NeteaseUserSource;
  static readonly Auth = _NeteaseAuth;
}
