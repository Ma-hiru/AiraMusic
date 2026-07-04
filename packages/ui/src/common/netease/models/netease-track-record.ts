import { NeteaseTrack } from "./netease-track";
import { NeteasePlaylist } from "./netease-playlist";

export class NeteaseTrackRecord {
  readonly id;
  readonly name;
  readonly sourceID;
  readonly sourceName;
  readonly detail;

  constructor(props: {
    sourceID: number;
    detail: NeteaseTrack;
    sourceName: NeteaseTrackRecordSourceType;
  }) {
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.detail = props.detail;
    this.id = this.detail.id;
    this.name = this.detail.name;
  }

  static toToolJSONValue(record: NeteaseTrackRecord): JsonValue {
    return {
      id: record.id,
      name: record.name,
      sourceID: record.sourceID,
      sourceName: record.sourceName,
      detail: record.detail.toToolJSONValue()
    };
  }

  static fromRecordObject<T extends Optional<NeteaseTrackRecordWithModel>>(
    record: T
  ): T extends Falsy ? null : NeteaseTrackRecord {
    if (!record) return null as T extends Falsy ? null : NeteaseTrackRecord;
    return new NeteaseTrackRecord({
      ...record,
      detail: NeteaseTrack.fromObject(record.detail)
    }) as T extends Falsy ? null : NeteaseTrackRecord;
  }

  static fromPlaylist(playlist: NeteasePlaylist) {
    return playlist.tracks.map(
      (detail) =>
        new NeteaseTrackRecord({
          detail,
          sourceID: playlist.id,
          sourceName: "playlist"
        })
    );
  }
}

type NeteaseTrackRecordWithModel = Omit<Jsonify<NeteaseTrackRecord>, "detail"> & {
  detail: NeteaseTrack | NeteaseTrackModel;
};
