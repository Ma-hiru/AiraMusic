import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import {
  NeteasePlaylistCreatorModel,
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

  setSize(size: NeteaseImageSize | number) {
    this.url = NeteaseURL.setImageSize(this.url, size);
    this.size = size;
    return this;
  }

  setAlt(alt: string) {
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

  static fromTrackCover(track: NeteaseTrack | NeteaseTrackRecord | NeteaseAPI.NeteaseTrack) {
    if ("al" in track) {
      return new NeteaseNetworkImage({
        url: track.al.picUrl,
        sourceID: track.id,
        sourceName: "track",
        alt: track.name
      });
    } else {
      return new NeteaseNetworkImage({
        url: track.track.al.picUrl,
        sourceID: track.id,
        sourceName: "track",
        alt: track.track.name
      });
    }
  }

  static fromPlaylistCover(
    playlist:
      | NeteaseAPI.NeteasePlaylistDetail
      | NeteaseAPI.NeteasePlaylistSummary
      | NeteasePlaylistSummary
  ) {
    return new NeteaseNetworkImage({
      url: playlist.coverImgUrl,
      sourceID: playlist.id,
      sourceName: "playlist"
    });
  }

  static fromURL(url: string) {
    return new NeteaseNetworkImage({
      url,
      sourceID: url,
      sourceName: "other"
    });
  }

  static fromUserAvatar(user: Optional<NeteaseUserModel | NeteasePlaylistCreatorModel>) {
    if (!user) return null;
    if ("profile" in user) {
      return new NeteaseNetworkImage({
        url: user.profile.avatarUrl,
        alt: user.profile.nickname,
        sourceName: "other",
        sourceID: ""
      });
    } else {
      return new NeteaseNetworkImage({
        url: user.avatarUrl,
        alt: user.nickname,
        sourceName: "other",
        sourceID: ""
      });
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
