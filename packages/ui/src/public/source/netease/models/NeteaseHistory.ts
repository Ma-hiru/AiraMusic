import { NeteaseTrack } from "./NeteaseTrack";
import { NeteaseTrackRecord } from "./NeteaseTrackRecord";

export class NeteaseHistory extends NeteaseTrackRecord {
  playDuration: number;
  time: number;

  constructor(props: {
    sourceID: number;
    detail: NeteaseTrack;
    sourceName: "playlist" | "album" | "other";
    playDuration: number;
    time: number;
  }) {
    super(props);
    this.playDuration = props.playDuration;
    this.time = props.time;
  }

  static fromObject<U extends NeteaseTrackRecord | NeteaseHistory, T extends Optional<U>>(
    record: T
  ): T extends Falsy ? null : U {
    if (!record) return null as T extends Falsy ? null : U;
    if ("playDuration" in record)
      return new NeteaseHistory({
        ...record,
        detail: NeteaseTrack.fromObject(record.detail)
      }) as T extends Falsy ? null : U;
    return NeteaseTrackRecord.fromObject({
      ...record,
      detail: NeteaseTrack.fromObject(record.detail)
    }) as T extends Falsy ? null : U;
  }

  static fromTrack(track: NeteaseTrackRecord, playDuration: number, time: number = Date.now()) {
    return new NeteaseHistory({
      ...track,
      playDuration,
      time
    });
  }
}
