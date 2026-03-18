import { NeteaseTrack } from "./NeteaseTrack";
import { NeteasePlaylist } from "@mahiru/ui/public/models/netease/NeteasePlaylist";

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
}
