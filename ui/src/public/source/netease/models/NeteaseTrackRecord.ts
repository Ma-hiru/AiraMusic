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

  static fromObject(record: Optional<NeteaseTrackRecord>) {
    if (!record) return null;
    return new NeteaseTrackRecord({ ...record, detail: NeteaseTrack.fromObject(record.detail) });
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
