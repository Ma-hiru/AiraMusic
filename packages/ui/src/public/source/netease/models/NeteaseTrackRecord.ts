import { NeteaseTrack } from "./NeteaseTrack";
import { NeteasePlaylist } from "@mahiru/ui/public/source/netease/models/NeteasePlaylist";

export class NeteaseTrackRecord {
  readonly id: number;
  readonly name: string;
  readonly sourceID;
  readonly sourceName;
  readonly detail;

  constructor(props: {
    sourceID: number;
    detail: NeteaseTrack;
    sourceName: "playlist" | "album" | "other";
  }) {
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.detail = props.detail;
    this.id = this.detail.id;
    this.name = this.detail.name;
  }

  static fromObject<T extends Optional<NeteaseTrackRecord>>(
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
