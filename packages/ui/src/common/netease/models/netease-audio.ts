import { TrackQuality } from "@/common/enum";

export class NeteaseNetworkAudio {
  readonly url;
  readonly quality;
  readonly id;
  readonly meta;

  constructor(props: {
    url: string;
    quality: TrackQuality;
    id: number;
    meta: NeteaseAPI.NeteaseSongUrlNewItem;
  }) {
    this.quality = props.quality;
    this.url = props.url;
    this.id = props.id;
    this.meta = props.meta;
  }

  /** 当前最优地址 */
  get src() {
    return this.url;
  }

  toNetworkAudio() {
    return new NeteaseNetworkAudio(this);
  }

  isNetwork(): this is NeteaseNetworkAudio {
    return NeteaseCommonAudio.isNetwork(this);
  }

  isLocal(): this is NeteaseLocalAudio {
    return NeteaseCommonAudio.isLocal(this);
  }
}

export class NeteaseLocalAudio extends NeteaseNetworkAudio {
  readonly localURL: string;

  constructor(props: {
    url: string;
    quality: TrackQuality;
    id: number;
    localURL: string;
    meta: NeteaseAPI.NeteaseSongUrlNewItem;
  }) {
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
      meta: network.meta,
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
