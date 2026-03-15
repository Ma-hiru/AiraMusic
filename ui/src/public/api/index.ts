import _NeteaseAlbumAPI from "@mahiru/ui/public/api/album";
import _NeteaseAuthAPI from "@mahiru/ui/public/api/auth";
import _NeteaseCommentAPI from "@mahiru/ui/public/api/comment";
import _NeteaseHomeAPI from "@mahiru/ui/public/api/home";
import _NeteasePlaylistAPI from "@mahiru/ui/public/api/playlist";
import _NeteaseMVAPI from "@mahiru/ui/public/api/mv";
import _NeteaseLyricAPI from "@mahiru/ui/public/api/lyric";
import _NeteaseSearchAPI from "@mahiru/ui/public/api/search";
import _NeteaseTrackAPI from "@mahiru/ui/public/api/track";
import _NeteaseUserAPI from "@mahiru/ui/public/api/user";
import _NeteaseRecordAPI from "@mahiru/ui/public/api/record";
import _NeteaseWikiAPI from "@mahiru/ui/public/api/wiki";

export default class NCM_API {
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
