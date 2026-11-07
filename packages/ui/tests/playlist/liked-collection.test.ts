import {
  createLikedCollection,
  formatCollectionDuration
} from "@mahiru/ui/common/utils/liked-collection";
import type { NeteaseTrack } from "@mahiru/ui/common/netease/models";

function track(
  id: number,
  artists: { id: number; name: string }[],
  overrides: { dt?: number; cover?: string; albumID?: number } = {}
): NeteaseTrack {
  return {
    id,
    ar: artists,
    dt: overrides.dt ?? 60000,
    al: {
      id: overrides.albumID ?? id,
      picUrl: overrides.cover ?? `https://example.com/${id}.jpg`
    }
  } as NeteaseTrack;
}

it("groups collaborators independently and counts each track once per artist", () => {
  const first = { id: 1, name: "Artist" };
  const second = { id: 2, name: "Guest" };
  const collection = createLikedCollection([track(11, [first, second, first]), track(12, [first])]);

  expect(collection.duration).toBe(120000);
  expect(collection.artists).toEqual([
    {
      key: "id:1",
      id: 1,
      name: "Artist",
      trackIDs: [11, 12],
      covers: ["https://example.com/11.jpg", "https://example.com/12.jpg"]
    },
    {
      key: "id:2",
      id: 2,
      name: "Guest",
      trackIDs: [11],
      covers: ["https://example.com/11.jpg"]
    }
  ]);
});

it("keeps equal names with different positive IDs and groups zero IDs by trimmed names", () => {
  const collection = createLikedCollection([
    track(1, [
      { id: 1, name: "Same" },
      { id: 2, name: "Same" },
      { id: 0, name: " First " },
      { id: 0, name: "Second" },
      { id: 0, name: "First" },
      { id: 3, name: "   " }
    ]),
    track(2, [{ id: 0, name: "First " }])
  ]);

  expect(collection.artists[0]).toMatchObject({
    key: "name:First",
    id: 0,
    name: "First",
    trackIDs: [1, 2]
  });
  expect(collection.artists.map((artist) => artist.key)).toEqual([
    "name:First",
    "id:1",
    "id:2",
    "name:Second"
  ]);
});

it("deduplicates tracks globally using their first occurrence and counts only real albums", () => {
  const artist = { id: 1, name: "Artist" };
  const collection = createLikedCollection([
    track(1, [artist], { albumID: 10, dt: 120000 }),
    track(1, [{ id: 2, name: "Ignored duplicate" }], { albumID: 11, dt: 999999 }),
    track(2, [artist], { albumID: 10, dt: 30000 }),
    track(3, [artist], { albumID: 0 }),
    track(4, [artist], { albumID: -1 }),
    track(5, [artist], { albumID: Number.NaN })
  ]);

  expect(collection.albumCount).toBe(1);
  expect(collection.duration).toBe(330000);
  expect(collection.artists).toHaveLength(1);
  expect(collection.artists[0]?.trackIDs).toEqual([1, 2, 3, 4, 5]);
});

it("preserves the first four distinct cover URLs in collection order", () => {
  const artist = { id: 1, name: "Artist" };
  const collection = createLikedCollection([
    track(1, [artist], { cover: "  https://example.com/a.jpg " }),
    track(2, [artist], { cover: "https://example.com/a.jpg" }),
    track(3, [artist], { cover: "   " }),
    track(4, [artist], { cover: "https://example.com/b.jpg" }),
    track(5, [artist], { cover: "https://example.com/c.jpg" }),
    track(6, [artist], { cover: "https://example.com/d.jpg" }),
    track(7, [artist], { cover: "https://example.com/e.jpg" })
  ]);

  expect(collection.artists[0]?.covers).toEqual([
    "https://example.com/a.jpg",
    "https://example.com/b.jpg",
    "https://example.com/c.jpg",
    "https://example.com/d.jpg"
  ]);
});

it("ignores invalid durations and empty artists without changing the input", () => {
  const tracks = [
    track(1, [], { dt: -1, cover: "" }),
    track(2, [{ id: 0, name: "" }], { dt: Number.NaN }),
    track(3, [], { dt: Number.POSITIVE_INFINITY }),
    track(4, [], { dt: 0 }),
    track(5, [], { dt: 1500 })
  ];
  const before = structuredClone(tracks);

  expect(createLikedCollection(tracks)).toMatchObject({
    duration: 1500,
    albumCount: 5,
    artists: []
  });
  expect(tracks).toEqual(before);
  expect(createLikedCollection([])).toEqual({
    duration: 0,
    albumCount: 0,
    artists: [],
    albums: []
  });
});

it("sorts by collection count, then artist name and a stable artist key", () => {
  const collection = createLikedCollection([
    track(1, [
      { id: 20, name: "Bravo" },
      { id: 2, name: "Alpha" },
      { id: 1, name: "Alpha" },
      { id: 3, name: "Charlie" }
    ]),
    track(2, [{ id: 20, name: "Bravo" }])
  ]);

  expect(collection.artists.map((artist) => artist.key)).toEqual(["id:20", "id:1", "id:2", "id:3"]);
});

it.each([
  [0, "0 分钟"],
  [-1, "0 分钟"],
  [Number.NaN, "0 分钟"],
  [Number.POSITIVE_INFINITY, "0 分钟"],
  [1, "不足 1 分钟"],
  [59999, "不足 1 分钟"],
  [60000, "1 分钟"],
  [3599999, "59 分钟"],
  [3600000, "1 小时"],
  [3660000, "1 小时 1 分钟"],
  [90000000, "25 小时"]
])("formats collection duration %s as %s", (duration, expected) => {
  expect(formatCollectionDuration(duration)).toBe(expected);
});
