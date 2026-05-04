import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models/NeteaseTrackRecord";

export class NeteaseAlbum {
  tracks: NeteaseTrackRecord[];
  content: NeteaseAPI.NeteaseAlbumContentResponse["album"];

  constructor(props: {
    content: NeteaseAPI.NeteaseAlbumContentResponse["album"];
    tracks: NeteaseTrackRecord[];
  }) {
    this.content = props.content;
    this.tracks = props.tracks;
  }

  static fromObject<T extends Optional<NeteaseAlbum>>(
    obj: T
  ): T extends Falsy ? null : NeteaseAlbum {
    if (!obj) return null as T extends Falsy ? null : NeteaseAlbum;
    return new NeteaseAlbum({
      content: obj.content,
      tracks: obj.tracks.map(NeteaseTrackRecord.fromObject)
    }) as T extends Falsy ? null : NeteaseAlbum;
  }
}
