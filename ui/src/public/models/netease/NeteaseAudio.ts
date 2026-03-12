import { TrackQuality } from "@mahiru/ui/public/enum";
import NCM_API from "@mahiru/ui/public/api";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";

export class NeteaseNetworkAudio {
  readonly url: string;
  readonly quality: TrackQuality;
  readonly id: number;

  constructor(props: { url: string; quality: TrackQuality; id: number }) {
    this.quality = props.quality;
    this.url = props.url;
    this.id = props.id;
  }

  static async fromTrack(track: NeteaseTrack, preference: TrackQuality) {
    const urlResponse = await NCM_API.Track.url(track.id, track.quality(preference));
    const meta = urlResponse.data[0];
    if (!meta) return null;
    return new NeteaseNetworkAudio({
      id: track.id,
      url: meta.url,
      quality: NeteaseTrack.qualityParse(meta)
    });
  }
}

export class NeteaseLocalAudio extends NeteaseNetworkAudio {
  readonly localURL: string;

  constructor(props: { url: string; quality: TrackQuality; id: number; localURL: string }) {
    super(props);
    this.localURL = props.localURL;
  }

  static fromNetworkImage(image: NeteaseNetworkAudio, localURL: string) {
    return new NeteaseLocalAudio({
      id: image.id,
      url: image.url,
      quality: image.quality,
      localURL
    });
  }
}
