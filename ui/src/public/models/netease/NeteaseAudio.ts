import { NeteaseTrack } from "./NeteaseTrack";
import { TrackQuality } from "@mahiru/ui/public/enum";
import NCM_API from "@mahiru/ui/public/api";

export class NeteaseNetworkAudio {
  readonly url: string;
  readonly quality: TrackQuality;
  readonly id: number;

  constructor(props: { url: string; quality: TrackQuality; id: number }) {
    this.quality = props.quality;
    this.url = props.url;
    this.id = props.id;
  }

  toNetworkAudio() {
    return new NeteaseNetworkAudio(this);
  }

  isNetwork() {
    return NeteaseCommonAudio.isNetwork(this);
  }

  isLocal() {
    return NeteaseCommonAudio.isLocal(this);
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

  static fromObject(
    audio: Optional<NeteaseNetworkAudio | NeteaseLocalAudio>
  ): Nullable<NeteaseNetworkAudio | NeteaseLocalAudio> {
    if (!audio) return null;
    if ("localURL" in audio) return new NeteaseLocalAudio(audio);
    return new NeteaseNetworkAudio(audio);
  }
}

export class NeteaseCommonAudio {
  static isLocal(
    audio: Optional<NeteaseNetworkAudio | NeteaseLocalAudio>
  ): audio is NeteaseLocalAudio {
    if (!audio) return false;
    return audio instanceof NeteaseLocalAudio && "localURL" in audio;
  }

  static isNetwork(
    audio: Optional<NeteaseNetworkAudio | NeteaseLocalAudio>
  ): audio is NeteaseNetworkAudio {
    if (!audio) return false;
    return !this.isLocal(audio);
  }
}
