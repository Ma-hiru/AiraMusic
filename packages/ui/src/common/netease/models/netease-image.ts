import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";

import { NeteaseURL } from "./netease-url";
import { NeteaseAlbum } from "./netease-album";
import { NeteaseTrack } from "./netease-track";
import { type NeteaseUserModel } from "./netease-user";
import { NeteaseTrackRecord } from "./netease-track-record";
import { NeteasePlaylistSummary } from "./netease-playlist-summary";

export class NeteaseNetworkImage {
  url;
  size;
  alt;
  cacheKey;
  readonly sourceID;
  readonly sourceName;

  get src() {
    return this.url;
  }

  constructor(props: {
    url: string;
    alt?: string;
    cacheKey?: string;
    sourceID: number | string;
    size?: number | NeteaseImageSize;
    sourceName: "album" | "other" | "track" | "avatar" | "playlist";
  }) {
    this.url = props.url;
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.size = props.size ?? NeteaseImageSize.raw;
    this.alt = props.alt;
    this.cacheKey = props.cacheKey;
    this.setSize(this.size);
  }

  setSize(size: Optional<number | NeteaseImageSize>) {
    if (!size) return this;
    this.url = NeteaseURL.setImageSize(this.url, size);
    this.size = size;
    return this;
  }

  private __appendKey = false;
  setCacheKey(cacheKey: Optional<string>) {
    if (!cacheKey) return this;
    if (this.__appendKey) {
      this.cacheKey += cacheKey;
    }
    return this;
  }

  setAlt(alt: Optional<string>) {
    if (!alt) return this;
    this.alt = alt;
    return this;
  }

  isNetwork(): this is NeteaseNetworkImage {
    return NeteaseCommonImage.isNetwork(this);
  }

  isLocal(): this is NeteaseLocalImage {
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
      NeteasePlaylistSummary | NeteaseAPI.NeteasePlaylistDetail | NeteaseAPI.NeteasePlaylistSummary
    >
  >(playlist: T): T extends Falsy ? null : NeteaseNetworkImage {
    if (!playlist) return null as T extends Falsy ? null : NeteaseNetworkImage;
    const instance = new NeteaseNetworkImage({
      url: playlist.coverImgUrl,
      sourceID: playlist.id,
      sourceName: "playlist",
      alt: playlist.name || playlist.coverImgUrl,
      cacheKey: `${playlist.updateTime}-${playlist.trackCount}-${playlist.trackUpdateTime}-${playlist.trackNumberUpdateTime}`
    }) as T extends Falsy ? null : NeteaseNetworkImage;
    instance!.__appendKey = true;
    return instance;
  }

  static fromAlbumCover<T extends Optional<NeteaseAlbum>>(
    album: T
  ): T extends Falsy ? null : NeteaseNetworkImage {
    if (!album) return null as T extends Falsy ? null : NeteaseNetworkImage;
    return new NeteaseNetworkImage({
      url: album.content.picUrl,
      sourceID: album.content.id,
      sourceName: "album",
      alt: album.content.name || album.content.picUrl
    }) as T extends Falsy ? null : NeteaseNetworkImage;
  }

  static fromURL<T extends Optional<string>>(url: T): T extends Falsy ? null : NeteaseNetworkImage {
    if (!url) return null as T extends Falsy ? null : NeteaseNetworkImage;
    if (!url.startsWith("http")) {
      Log.warn("NeteaseNetworkImage.fromURL", "not network url:", url);
      return new NeteaseNetworkImage({
        url: "",
        sourceID: url,
        sourceName: "other"
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    }
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
        sourceID: user.profile.userId,
        cacheKey: user.profile.avatarUrl,
        sourceName: "avatar"
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    } else {
      return new NeteaseNetworkImage({
        url: user.avatarUrl,
        alt: user.nickname,
        sourceID: user.userId,
        cacheKey: user.avatarUrl,
        sourceName: "avatar"
      }) as T extends Falsy ? null : NeteaseNetworkImage;
    }
  }
}

export class NeteaseLocalImage extends NeteaseNetworkImage {
  readonly localURL;
  readonly localSize;

  constructor(props: {
    url: string;
    localURL: string;
    sourceID: number | string;
    size?: number | NeteaseImageSize;
    localSize?: number | NeteaseImageSize;
    sourceName: "album" | "other" | "track" | "avatar" | "playlist";
  }) {
    super(props);
    this.localURL = props.localURL;
    this.localSize = props.localSize ?? props.size ?? NeteaseImageSize.raw;
  }

  override get src() {
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
    image: Optional<NeteaseLocalImage | NeteaseNetworkImage>
  ): Nullable<NeteaseLocalImage | NeteaseNetworkImage> {
    if (!image) return null;
    if ("localURL" in image) return new NeteaseLocalImage(image);
    return new NeteaseNetworkImage(image);
  }
}

export class NeteaseCommonImage {
  static isLocal(
    image: Optional<NeteaseLocalImage | NeteaseNetworkImage>
  ): image is NeteaseLocalImage {
    return image?.constructor === NeteaseLocalImage;
  }

  static isNetwork(
    image: Optional<NeteaseLocalImage | NeteaseNetworkImage>
  ): image is NeteaseNetworkImage {
    return image?.constructor === NeteaseNetworkImage;
  }
}
