/** 收藏列表分页结果 */
export type NeteaseStarPage<T> = {
  items: T[];
  count: number;
  hasMore: boolean;
};

/** 收藏的专辑 */
export class NeteaseStarAlbum {
  readonly id: number;
  readonly name: string;
  readonly coverUrl: string;
  /** 专辑曲目数 */
  readonly size: number;
  /** 收藏时间 */
  readonly subTime: number;
  readonly artists: {
    readonly id: number;
    readonly name: string;
    readonly alias: string[];
  }[];

  constructor(props: {
    id: number;
    name: string;
    size: number;
    subTime: number;
    coverUrl: string;
    artists: {
      id: number;
      name: string;
      alias: string[];
    }[];
  }) {
    this.id = props.id;
    this.name = props.name;
    this.coverUrl = props.coverUrl;
    this.size = props.size;
    this.subTime = props.subTime;
    this.artists = props.artists;
  }

  get artistNames() {
    return this.artists
      .map((artist) => artist.name)
      .filter(Boolean)
      .join(" / ");
  }

  static fromNeteaseAPI(album: NeteaseAPI.NeteaseLikedAlbum) {
    return new NeteaseStarAlbum({
      id: album.id,
      name: album.name,
      coverUrl: album.picUrl,
      size: album.size ?? 0,
      subTime: album.subTime ?? 0,
      artists: (album.artists ?? []).map((artist) => ({
        id: artist.id,
        name: artist.name,
        alias: artist.alias ?? []
      }))
    });
  }

  static fromObject(album: Jsonify<NeteaseStarAlbum>) {
    return new NeteaseStarAlbum(album);
  }
}

/** 收藏的歌手 */
export class NeteaseStarArtist {
  readonly id: number;
  readonly name: string;
  readonly coverUrl: string;
  readonly alias: string[];
  readonly albumSize: number;
  readonly mvSize: number;
  readonly fansCount: number;
  readonly followed: boolean;
  /** 收藏时间 */
  readonly subTime: number;

  constructor(props: {
    id: number;
    name: string;
    mvSize: number;
    alias: string[];
    subTime: number;
    coverUrl: string;
    albumSize: number;
    fansCount: number;
    followed: boolean;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.coverUrl = props.coverUrl;
    this.alias = props.alias;
    this.albumSize = props.albumSize;
    this.mvSize = props.mvSize;
    this.fansCount = props.fansCount;
    this.followed = props.followed;
    this.subTime = props.subTime;
  }

  get aliasText() {
    return this.alias.filter(Boolean).join(" / ");
  }

  static fromNeteaseAPI(artist: NeteaseAPI.NeteaseLikedArtist) {
    return new NeteaseStarArtist({
      id: artist.id,
      name: artist.name,
      coverUrl: artist.picUrl,
      alias: artist.alias ?? [],
      albumSize: artist.albumSize ?? 0,
      mvSize: artist.mvSize ?? 0,
      fansCount: artist.fansCount ?? 0,
      followed: Boolean(artist.followed),
      subTime: artist.subTime ?? 0
    });
  }

  static fromObject(artist: Jsonify<NeteaseStarArtist>) {
    return new NeteaseStarArtist(artist);
  }
}
