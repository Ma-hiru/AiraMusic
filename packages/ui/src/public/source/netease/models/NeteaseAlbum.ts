import { NeteaseTrack } from "@mahiru/ui/public/source/netease/models/NeteaseTrack";

export class NeteaseAlbum {
  tracks: NeteaseTrack[];
  content: NeteaseAPI.NeteaseAlbumContentResponse["album"];

  constructor(props: {
    content: NeteaseAPI.NeteaseAlbumContentResponse["album"];
    tracks: NeteaseTrack[];
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
      tracks: obj.tracks
    }) as T extends Falsy ? null : NeteaseAlbum;
  }
}
