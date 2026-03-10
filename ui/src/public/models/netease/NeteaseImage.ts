import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import NeteasePlaylist from "@mahiru/ui/public/models/netease/NeteasePlaylist";

export class NeteaseNetworkImage {
  url: string;
  size!: NeteaseImageSize | number;
  readonly sourceID: number | string;
  readonly sourceName: "track" | "playlist" | "other";

  constructor(props: {
    url: string;
    sourceID: number | string;
    sourceName: "track" | "playlist" | "other";
  }) {
    this.url = props.url;
    this.sourceID = props.sourceID;
    this.sourceName = props.sourceName;
    this.setSize(NeteaseImageSize.raw);
  }

  setSize(size: NeteaseImageSize | number) {
    this.url = NeteaseNetworkImage.setNeteaseImageURLSize(this.url, size);
    this.size = size;
  }

  /** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
  static setNeteaseImageURLSize<T extends Optional<string>>(
    url: T,
    size: NeteaseImageSize | number
  ): T extends Falsy ? undefined : string {
    if (!url || !url.startsWith("http")) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }
    if (!Number.isFinite(size) || size < 0) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }

    const u = new URL(url);
    if (size !== NeteaseImageSize.raw) {
      u.searchParams.set("param", `${size}y${size}`);
      u.searchParams.set("type", "webp");
    } else {
      u.searchParams.delete("param");
      u.searchParams.delete("type");
    }

    return <T extends Falsy ? undefined : string>u.toString();
  }

  static fromTrackCover(track: NeteaseTrack | NeteaseAPI.NeteaseTrack) {
    return new NeteaseNetworkImage({
      url: track.al.picUrl,
      sourceID: track.id,
      sourceName: "track"
    });
  }

  static fromPlaylistCover(
    playlist: NeteasePlaylist | NeteaseAPI.NeteasePlaylistDetail | NeteaseAPI.NeteasePlaylistSummary
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
}

export class NeteaseLocalImage extends NeteaseNetworkImage {
  readonly localURL: string;
  readonly localSize: NeteaseImageSize | number;

  constructor(props: {
    url: string;
    sourceID: number | string;
    sourceName: "track" | "playlist" | "other";
    localURL: string;
    localSize: NeteaseImageSize | number;
  }) {
    super(props);
    this.localURL = props.localURL;
    this.localSize = props.localSize;
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
}
