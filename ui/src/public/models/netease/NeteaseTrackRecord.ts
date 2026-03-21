import { NeteaseTrack } from "./NeteaseTrack";
import { NeteasePlaylist } from "@mahiru/ui/public/models/netease/NeteasePlaylist";
import { NeteaseHistory } from "@mahiru/ui/public/models/netease/NeteaseHistory";

export class NeteaseTrackRecord {
  readonly id: number;
  readonly name: string;
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
    this.id = this.track.id;
    this.name = this.track.name;
  }

  static fromObject(record: Optional<NeteaseTrackRecord>) {
    if (!record) return null;
    return new NeteaseTrackRecord({ ...record, track: NeteaseTrack.fromObject(record.track) });
  }

  static fromPlaylist(playlist: NeteasePlaylist) {
    return playlist.tracks.map(
      (track) =>
        new NeteaseTrackRecord({
          track,
          sourceID: playlist.id,
          sourceName: "playlist"
        })
    );
  }

  static fromTrack(track: NeteaseTrackRecord, playDuration: number, time: number = Date.now()) {
    return new NeteaseHistory({
      ...track,
      playDuration,
      time
    });
  }
}
