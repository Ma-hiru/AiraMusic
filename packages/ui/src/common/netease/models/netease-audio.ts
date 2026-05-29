import { TrackQuality } from "@/common/enum";

export class NeteaseNetworkAudio {
  readonly url: string;
  readonly quality: TrackQuality;
  readonly id: number;

  constructor(props: { url: string; quality: TrackQuality; id: number }) {
    this.quality = props.quality;
    this.url = props.url;
    this.id = props.id;
  }

  /** 当前最优地址 */
  get src() {
    return this.url;
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
}

export class NeteaseLocalAudio extends NeteaseNetworkAudio {
  readonly localURL: string;

  constructor(props: { url: string; quality: TrackQuality; id: number; localURL: string }) {
    super(props);
    this.localURL = props.localURL;
  }

  override get src() {
    return this.localURL || this.url;
  }

  static fromNetwork(network: NeteaseNetworkAudio, localURL: string) {
    return new NeteaseLocalAudio({
      id: network.id,
      url: network.url,
      quality: network.quality,
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
    return audio?.constructor === NeteaseLocalAudio;
  }

  static isNetwork(
    audio: Optional<NeteaseNetworkAudio | NeteaseLocalAudio>
  ): audio is NeteaseNetworkAudio {
    return audio?.constructor === NeteaseNetworkAudio;
  }
}
