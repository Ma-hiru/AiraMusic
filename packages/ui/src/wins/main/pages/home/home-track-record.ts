import { type NeteaseTrack, NeteaseTrackRecord } from "@/common/netease/models";

export const createHomeTrackRecord = (track: NeteaseTrack) => {
  return new NeteaseTrackRecord({
    detail: track,
    sourceID: -1,
    sourceName: "other"
  });
};
