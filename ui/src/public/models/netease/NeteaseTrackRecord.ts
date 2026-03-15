import { NeteaseTrack } from "./NeteaseTrack";

export class NeteaseTrackRecord {
  readonly sourceID;
  readonly sourceName;
  readonly track;

  constructor(props: {
    sourceID: number;
    track: NeteaseTrack;
    sourceName: "playlist" | "album" | "other";
  }) {
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.track = props.track;
  }

  static fromObject(record: Optional<NeteaseTrackRecord>) {
    if (!record) return null;
    return new NeteaseTrackRecord(record);
  }
}
