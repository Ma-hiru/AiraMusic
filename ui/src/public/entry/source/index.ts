import NeteaseImageSource from "@mahiru/ui/public/entry/source/image";
import NeteaseLyricSource from "@mahiru/ui/public/entry/source/lyric";
import NeteaseTrackSource from "@mahiru/ui/public/entry/source/track";
import NeteasePlaylistSource from "@mahiru/ui/public/entry/source/playlist";
import NeteaseCommentSource from "@mahiru/ui/public/entry/source/comment";

export class NeteaseSource {
  static readonly Image = NeteaseImageSource;
  static readonly Lyric = NeteaseLyricSource;
  static readonly Track = NeteaseTrackSource;
  static readonly Playlist = NeteasePlaylistSource;
  static readonly Comment = NeteaseCommentSource;
}
