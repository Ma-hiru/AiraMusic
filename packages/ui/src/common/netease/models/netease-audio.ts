import { TrackQuality } from "@/common/enum";

import { NeteaseURL } from "./netease-url";

interface NeteaseNetworkAudioProps {
  id: number;
  url: string;
  quality: TrackQuality;
  meta: NeteaseAPI.NeteaseSongUrlNewItem;
}

interface NeteaseLocalAudioProps extends NeteaseNetworkAudioProps {
  localURL: string;
}

export class NeteaseNetworkAudio {
  readonly url: string;
  readonly quality: TrackQuality;
  readonly id: number;
  readonly meta: NeteaseAPI.NeteaseSongUrlNewItem;

  constructor(props: NeteaseNetworkAudioProps) {
    this.quality = props.quality;
    this.url = NeteaseURL.toSecure(props.url);
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

  constructor(props: NeteaseLocalAudioProps) {
    super(props);
    this.localURL = props.localURL;
  }

  override get src() {
    return this.localURL || this.url;
  }

  static fromNetwork(network: NeteaseNetworkAudioProps, localURL: string) {
    return new NeteaseLocalAudio({
      id: network.id,
      url: network.url,
      quality: network.quality,
      meta: network.meta,
      localURL
    });
  }

  static fromObject<T extends Optional<NeteaseLocalAudioProps | NeteaseNetworkAudioProps>>(
    audio: T
  ): FromObjectReturn<T> {
    let res;

    if (!audio) res = null;
    else if ("localURL" in audio) res = new NeteaseLocalAudio(audio);
    else res = new NeteaseNetworkAudio(audio);

    return res as FromObjectReturn<T>;
  }
}

export class NeteaseCommonAudio {
  static isLocal(
    audio: Optional<NeteaseLocalAudio | NeteaseNetworkAudio>
  ): audio is NeteaseLocalAudio {
    return audio?.constructor === NeteaseLocalAudio;
  }

  static isNetwork(
    audio: Optional<NeteaseLocalAudio | NeteaseNetworkAudio>
  ): audio is NeteaseNetworkAudio {
    return audio?.constructor === NeteaseNetworkAudio;
  }
}

type FromObjectReturn<T extends Optional<NeteaseLocalAudioProps | NeteaseNetworkAudioProps>> =
  T extends Falsy
    ? null
    : T extends NeteaseLocalAudioProps
      ? NeteaseLocalAudio
      : NeteaseNetworkAudio;
