import { NeteaseTrack } from "./netease-track";
import { NeteaseTrackRecord } from "@/common/netease/models/netease-track-record";

export class NeteaseHistoryRecord extends NeteaseTrackRecord {
  /** s 秒 */
  playDuration: number;
  time: number;

  constructor(props: {
    sourceID: number;
    detail: NeteaseTrack;
    sourceName: NeteaseTrackRecordSourceType;
    playDuration: number;
    time: number;
  }) {
    super(props);
    this.playDuration = props.playDuration;
    this.time = props.time;
  }

  static fromHistoryObject<T extends Optional<NeteaseHistoryWithModel>>(
    record: T
  ): T extends Falsy ? null : NeteaseHistoryRecord {
    if (!record) return null as T extends Falsy ? null : NeteaseHistoryRecord;
    return new NeteaseHistoryRecord({
      ...record,
      detail: NeteaseTrack.fromObject(record.detail)
    }) as T extends Falsy ? null : NeteaseHistoryRecord;
  }

  static fromTrack(track: NeteaseTrackRecord, playDuration: number, time: number = Date.now()) {
    return new NeteaseHistoryRecord({
      ...track,
      playDuration,
      time
    });
  }
}

type NeteaseHistoryWithModel = Omit<NeteaseHistoryRecord, "detail"> & {
  detail: NeteaseTrack | NeteaseTrackModel;
};
