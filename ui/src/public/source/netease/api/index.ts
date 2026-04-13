import _NeteaseAlbumAPI from "@mahiru/ui/public/source/netease/api/album";
import _NeteaseAuthAPI from "@mahiru/ui/public/source/netease/api/auth";
import _NeteaseCommentAPI from "@mahiru/ui/public/source/netease/api/comment";
import _NeteaseHomeAPI from "@mahiru/ui/public/source/netease/api/home";
import _NeteasePlaylistAPI from "@mahiru/ui/public/source/netease/api/playlist";
import _NeteaseMVAPI from "@mahiru/ui/public/source/netease/api/mv";
import _NeteaseLyricAPI from "@mahiru/ui/public/source/netease/api/lyric";
import _NeteaseSearchAPI from "@mahiru/ui/public/source/netease/api/search";
import _NeteaseTrackAPI from "@mahiru/ui/public/source/netease/api/track";
import _NeteaseUserAPI from "@mahiru/ui/public/source/netease/api/user";
import _NeteaseRecordAPI from "@mahiru/ui/public/source/netease/api/record";
import _NeteaseWikiAPI from "@mahiru/ui/public/source/netease/api/wiki";

export default class NeteaseAPI {
  static readonly Album = _NeteaseAlbumAPI;
  static readonly Auth = _NeteaseAuthAPI;
  static readonly Comment = _NeteaseCommentAPI;
  static readonly Home = _NeteaseHomeAPI;
  static readonly Lyric = new _NeteaseLyricAPI();
  static readonly MV = _NeteaseMVAPI;
  static readonly Playlist = _NeteasePlaylistAPI;
  static readonly Record = _NeteaseRecordAPI;
  static readonly Search = _NeteaseSearchAPI;
  static readonly Track = _NeteaseTrackAPI;
  static readonly User = _NeteaseUserAPI;
  static readonly Wiki = _NeteaseWikiAPI;
}
