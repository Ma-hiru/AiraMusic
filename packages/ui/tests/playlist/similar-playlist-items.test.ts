import { createSimilarPlaylistItems } from "@mahiru/ui/common/components/page/playlist-v2/similar-playlist-items";
import type NeteaseAPIPlaylist from "@mahiru/ui/common/netease/api/playlist";

type RelatedPlaylistResponse = Awaited<ReturnType<typeof NeteaseAPIPlaylist.relative>>;

function response(ids: number[]): RelatedPlaylistResponse {
  return {
    code: 200,
    data: {
      rcmdTitle: "喜欢这个歌单的用户也听了",
      jumpUrl: "orpheus://playlistCollection",
      recPlaylist: ids.map((id) => ({
        alg: "alg_similar_tag",
        playlist: {
          id,
          name: `歌单 ${id}`,
          coverImgUrl: `https://example.com/${id}.jpg`,
          playCount: id * 100,
          specialType: 0,
          action: `orpheus://playlist/${id}`
        }
      }))
    }
  };
}

it("maps the related-playlist response without inventing missing metadata", () => {
  expect(createSimilarPlaylistItems(response([2]), 1)).toEqual([
    {
      id: 2,
      name: "歌单 2",
      coverUrl: "https://example.com/2.jpg",
      playCount: 200
    }
  ]);
});

it("excludes the current playlist and duplicate recommendations while preserving order", () => {
  expect(createSimilarPlaylistItems(response([1, 3, 3, 2, 1]), 1).map((item) => item.id)).toEqual([
    3, 2
  ]);
});

it("allows the provider to return no recommendations", () => {
  expect(createSimilarPlaylistItems({ code: 200, data: null }, 1)).toEqual([]);
  expect(createSimilarPlaylistItems(response([]), 1)).toEqual([]);
});
