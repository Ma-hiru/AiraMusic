import { NeteaseTrackRecord } from "./netease-track-record";

export class NeteaseAlbum {
  tracks: NeteaseTrackRecord[];
  content: NeteaseAPI.NeteaseAlbumContentResponse["album"];

  constructor(props: {
    tracks: NeteaseTrackRecord[];
    content: NeteaseAPI.NeteaseAlbumContentResponse["album"];
  }) {
    this.content = props.content;
    this.tracks = props.tracks;
  }

  /** @deprecated Agent 输出请统一使用 RendererTool.album。 */
  toToolJSONValue(): JsonValue {
    return {
      content: this.content,
      tracks: this.tracks.map(NeteaseTrackRecord.toToolJSONValue)
    } as unknown as JsonValue;
  }

  static fromObject<T extends Optional<Jsonify<NeteaseAlbum>>>(
    obj: T
  ): T extends Falsy ? null : NeteaseAlbum {
    if (!obj) return null as T extends Falsy ? null : NeteaseAlbum;
    return new NeteaseAlbum({
      content: obj.content,
      tracks: obj.tracks.map(NeteaseTrackRecord.fromRecordObject)
    }) as T extends Falsy ? null : NeteaseAlbum;
  }
}
