import { NeteaseTrack } from "./NeteaseTrack";
import { NeteaseTrackRecord } from "./NeteaseTrackRecord";

export class NeteaseHistory extends NeteaseTrackRecord {
  playDuration: number;
  time: number;

  constructor(props: {
    sourceID: number;
    track: NeteaseTrack;
    sourceName: "playlist" | "album" | "other";
    playDuration: number;
    time: number;
  }) {
    super(props);
    this.playDuration = props.playDuration;
    this.time = props.time;
  }

  static fromObject(
    record: Optional<NeteaseTrackRecord | NeteaseHistory>
  ): Nullable<NeteaseTrackRecord | NeteaseHistory> {
    if (!record) return null;

    if ("playDuration" in record)
      return new NeteaseHistory({ ...record, track: NeteaseTrack.fromObject(record.track) });
    return NeteaseTrackRecord.fromObject(record);
  }

  static fromTrack(track: NeteaseTrackRecord, playDuration: number, time: number = Date.now()) {
    return new NeteaseHistory({
      ...track,
      playDuration,
      time
    });
  }
}
