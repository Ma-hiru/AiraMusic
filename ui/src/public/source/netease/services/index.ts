import NeteaseImageSource from "@mahiru/ui/public/source/netease/services/image";
import NeteaseLyricSource from "@mahiru/ui/public/source/netease/services/lyric";
import NeteaseTrackSource from "@mahiru/ui/public/source/netease/services/track";
import NeteasePlaylistSource from "@mahiru/ui/public/source/netease/services/playlist";
import NeteaseCommentSource from "@mahiru/ui/public/source/netease/services/comment";
import NeteaseAudioSource from "@mahiru/ui/public/source/netease/services/audio";
import NeteaseUserSource from "@mahiru/ui/public/source/netease/services/user";
import NeteaseAuth from "@mahiru/ui/public/source/netease/services/auth";

export default class NeteaseServices {
  static readonly Audio = NeteaseAudioSource;
  static readonly Comment = NeteaseCommentSource;
  static readonly Image = NeteaseImageSource;
  static readonly Lyric = NeteaseLyricSource;
  static readonly Playlist = NeteasePlaylistSource;
  static readonly Track = NeteaseTrackSource;
  static readonly User = NeteaseUserSource;
  static readonly Auth = NeteaseAuth;
}
