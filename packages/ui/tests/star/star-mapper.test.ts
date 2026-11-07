import {
  NeteaseStarAlbum,
  NeteaseStarArtist,
  NeteasePlaylistSummary
} from "@mahiru/ui/common/netease/models";
import {
  albumToMediaItem,
  artistToMediaItem,
  playlistToMediaItem
} from "@mahiru/ui/common/components/page/star/mapper";

type AlbumInput = Parameters<typeof NeteaseStarAlbum.fromNeteaseAPI>[0];
type ArtistInput = Parameters<typeof NeteaseStarArtist.fromNeteaseAPI>[0];

function createAlbum(overrides: Partial<AlbumInput> = {}) {
  return NeteaseStarAlbum.fromNeteaseAPI({
    id: 101,
    name: "Test Album",
    picUrl: "https://example.com/album.jpg",
    size: 12,
    subTime: 1,
    artists: [
      { id: 1, name: "Artist A", alias: [] },
      { id: 2, name: "Artist B", alias: [] }
    ],
    ...overrides
  });
}

function createArtist(overrides: Partial<ArtistInput> = {}) {
  return NeteaseStarArtist.fromNeteaseAPI({
    id: 201,
    name: "Test Artist",
    picUrl: "https://example.com/artist.jpg",
    alias: ["Alias"],
    albumSize: 8,
    mvSize: 2,
    fansCount: 12345,
    followed: true,
    ...overrides
  });
}

it("maps a playlist summary to a media card", () => {
  const playlist = NeteasePlaylistSummary.fromObject({
    id: 1,
    name: "Test Playlist",
    tags: [],
    userId: 1,
    privacy: 0,
    playCount: 123456,
    createTime: 0,
    trackCount: 18,
    updateTime: 0,
    coverImgUrl: "https://example.com/playlist.jpg",
    subscribed: true,
    highQuality: false,
    subscribedCount: 0,
    trackUpdateTime: 0,
    description: "",
    trackNumberUpdateTime: 0,
    creator: {
      userId: 2,
      nickname: "Creator",
      avatarUrl: "",
      signature: ""
    }
  });

  expect(playlistToMediaItem(playlist)).toMatchObject({
    id: 1,
    name: "Test Playlist",
    coverUrl: "https://example.com/playlist.jpg",
    playCount: 123456,
    badge: "18 首",
    meta: "Creator"
  });
});

it("maps a liked album and joins artist names", () => {
  expect(albumToMediaItem(createAlbum())).toMatchObject({
    id: 101,
    name: "Test Album",
    coverUrl: "https://example.com/album.jpg",
    badge: "12 首",
    meta: "Artist A / Artist B",
    nameClampLine: 1
  });
});

it("omits album meta when the album has no artists", () => {
  expect(albumToMediaItem(createAlbum({ artists: [] })).meta).toBeUndefined();
});

it("maps a liked artist to a circular card with alias", () => {
  expect(artistToMediaItem(createArtist())).toMatchObject({
    id: 201,
    name: "Test Artist",
    coverUrl: "https://example.com/artist.jpg",
    shape: "circle",
    badge: "专辑 8",
    meta: "Alias"
  });
});

it("falls back to formatted fan count when the artist has no alias", () => {
  expect(artistToMediaItem(createArtist({ alias: [] })).meta).toBe("1.2W 粉丝");
});
