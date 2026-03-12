import NeteaseImageSource from "@mahiru/ui/public/entry/source/image";
import NeteaseLyricSource from "@mahiru/ui/public/entry/source/lyric";
import NeteaseTrackSource from "@mahiru/ui/public/entry/source/track";
import NeteasePlaylistSource from "@mahiru/ui/public/entry/source/playlist";
import NeteaseCommentSource from "@mahiru/ui/public/entry/source/comment";
import NeteaseAudioSource from "@mahiru/ui/public/entry/source/audio";
import NeteaseUserSource from "@mahiru/ui/public/entry/source/user";

export default class NeteaseSource {
  static readonly Audio = NeteaseAudioSource;
  static readonly Comment = NeteaseCommentSource;
  static readonly Image = NeteaseImageSource;
  static readonly Lyric = NeteaseLyricSource;
  static readonly Playlist = NeteasePlaylistSource;
  static readonly Track = NeteaseTrackSource;
  static readonly User = NeteaseUserSource;
}
