import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import {
  NeteasePlaylistSummary,
  NeteaseTrack,
  NeteaseTrackRecord,
  NeteaseURL,
  NeteaseUserModel
} from "@mahiru/ui/public/models/netease";

export class NeteaseNetworkImage {
  url;
  size;
  alt;
  readonly sourceID;
  readonly sourceName;

  get src() {
    return this.url;
  }

  constructor(props: {
    url: string;
    sourceID: number | string;
    sourceName: "track" | "playlist" | "other";
    size?: NeteaseImageSize | number;
    alt?: string;
  }) {
    this.url = props.url;
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.size = props.size ?? NeteaseImageSize.raw;
    this.alt = props.alt;
    this.setSize(this.size);
  }

  setSize(size: Optional<NeteaseImageSize | number>) {
    if (!size) return this;
    this.url = NeteaseURL.setImageSize(this.url, size);
    this.size = size;
    return this;
  }

  setAlt(alt: Optional<string>) {
    if (!alt) return this;
    this.alt = alt;
    return this;
  }

  get isNetwork() {
    return NeteaseCommonImage.isNetwork(this);
  }

  get isLocal() {
    return NeteaseCommonImage.isLocal(this);
  }

  toNetworkImage() {
    return new NeteaseNetworkImage(this);
  }

  static fromTrackCover<
    T extends Optional<
      NeteaseTrack | NeteaseTrackModel | NeteaseTrackRecord | NeteaseAPI.NeteaseTrack
    >
  >(track: T): T extends Falsy ? null : NeteaseNetworkImage {
    if (!track) return null as T extends Falsy ? null : NeteaseNetworkImage;
    if ("al" in track) {
      return new NeteaseNetworkImage({
        url: track.al.picUrl,
        sourceID: track.id,
        sourceName: "track",
        alt: track.name
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    } else {
      return new NeteaseNetworkImage({
        url: track.detail.al.picUrl,
        sourceID: track.id,
        sourceName: "track",
        alt: track.detail.name
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    }
  }

  static fromPlaylistCover<
    T extends Optional<
      NeteaseAPI.NeteasePlaylistDetail | NeteaseAPI.NeteasePlaylistSummary | NeteasePlaylistSummary
    >
  >(playlist: T): T extends Falsy ? null : NeteaseNetworkImage {
    if (!playlist) return null as T extends Falsy ? null : NeteaseNetworkImage;
    return new NeteaseNetworkImage({
      url: playlist.coverImgUrl,
      sourceID: playlist.id,
      sourceName: "playlist",
      alt: playlist.name || playlist.coverImgUrl
    }) as T extends Falsy ? null : NeteaseNetworkImage;
  }

  static fromURL<T extends Optional<string>>(url: T): T extends Falsy ? null : NeteaseNetworkImage {
    if (!url) return null as T extends Falsy ? null : NeteaseNetworkImage;
    return new NeteaseNetworkImage({
      url,
      sourceID: url,
      sourceName: "other"
    }) as T extends Falsy ? null : NeteaseNetworkImage;
  }

  static fromUserAvatar<T extends Optional<NeteaseUserModel | NeteasePlaylistCreatorModel>>(
    user: T
  ): T extends Falsy ? null : NeteaseNetworkImage {
    if (!user) return null as T extends Falsy ? null : NeteaseNetworkImage;
    if ("profile" in user) {
      return new NeteaseNetworkImage({
        url: user.profile.avatarUrl,
        alt: user.profile.nickname,
        sourceName: "other",
        sourceID: ""
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    } else {
      return new NeteaseNetworkImage({
        url: user.avatarUrl,
        alt: user.nickname,
        sourceName: "other",
        sourceID: ""
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    }
  }
}

export class NeteaseLocalImage extends NeteaseNetworkImage {
  readonly localURL;
  readonly localSize;

  constructor(props: {
    url: string;
    sourceID: number | string;
    sourceName: "track" | "playlist" | "other";
    size?: NeteaseImageSize | number;
    localURL: string;
    localSize?: NeteaseImageSize | number;
  }) {
    super(props);
    this.localURL = props.localURL;
    this.localSize = props.localSize ?? props.size ?? NeteaseImageSize.raw;
  }

  get src() {
    return this.localURL;
  }

  static fromNetworkImage(image: NeteaseNetworkImage, localURL: string) {
    return new NeteaseLocalImage({
      url: image.url,
      sourceID: image.sourceID,
      sourceName: image.sourceName,
      localSize: image.size,
      localURL
    });
  }

  static fromObject(
    image: Optional<NeteaseNetworkImage | NeteaseLocalImage>
  ): Nullable<NeteaseNetworkImage | NeteaseLocalImage> {
    if (!image) return null;
    if ("localURL" in image) return new NeteaseLocalImage(image);
    return new NeteaseNetworkImage(image);
  }
}

export class NeteaseCommonImage {
  static isLocal(
    image: Optional<NeteaseNetworkImage | NeteaseLocalImage>
  ): image is NeteaseLocalImage {
    return image?.constructor === NeteaseLocalImage;
  }

  static isNetwork(
    image: Optional<NeteaseNetworkImage | NeteaseLocalImage>
  ): image is NeteaseNetworkImage {
    return image?.constructor === NeteaseNetworkImage;
  }
}
