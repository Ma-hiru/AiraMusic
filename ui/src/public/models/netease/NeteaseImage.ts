import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import NeteasePlaylist from "@mahiru/ui/public/models/netease/NeteasePlaylist";
import NeteaseURL from "@mahiru/ui/public/models/netease/NeteaseURL";

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
    this.url = NeteaseURL.setImageSize(this.url, size);
    this.size = size;
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
