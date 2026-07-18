import { it, expect, describe } from "vitest";
import { RendererTool } from "@mahiru/ui/common/lib/renderer-tool";
import type {
  NeteaseAlbum,
  NeteaseLyric,
  NeteaseTrack,
  NeteaseArtist,
  NeteasePlaylist,
  NeteaseTrackRecord
} from "@mahiru/ui/common/netease/models";

const asObject = (value: JsonValue) => value as { [key: string]: JsonValue };

const track = {
  id: 101,
  name: "Track",
  ar: [{ id: 201, name: "Artist", picUrl: "should-not-leak" }],
  al: { id: 301, name: "Album", picUrl: "https://example.test/cover.jpg", extra: "drop" },
  alia: ["Alias"],
  tns: ["Translated"],
  dt: 180_000,
  publishTime: 1_700_000_000_000,
  no: 2,
  pop: 88,
  fee: 0,
  mv: 401,
  hr: { br: 1_000_000, size: 10_000, sr: 96_000, extra: "drop" },
  sq: null,
  h: null,
  m: null,
  l: null
} as unknown as NeteaseTrack;

const record = {
  id: track.id,
  name: track.name,
  sourceID: 501,
  sourceName: "playlist",
  detail: track
} as unknown as NeteaseTrackRecord;

describe("RendererTool", () => {
  it("projects music domain models without forwarding their raw response objects", () => {
    const projectedTrack = asObject(RendererTool.track(track, "detail"));
    expect(projectedTrack["id"]).toBe(101);
    expect(asObject((projectedTrack["artists"] as JsonValue[])[0]!)).toEqual({
      id: 201,
      name: "Artist"
    });
    expect(asObject(projectedTrack["album"]!)["extra"]).toBeUndefined();
    expect(
      asObject(asObject(projectedTrack["qualities"]!)["highResolution"]!)["extra"]
    ).toBeUndefined();

    const projectedRecord = asObject(RendererTool.record(record));
    expect(asObject(projectedRecord["source"]!)).toEqual({ id: 501, type: "playlist" });

    const album = {
      content: {
        id: 301,
        name: "Album",
        description: "Description",
        artists: [{ id: 201, name: "Artist", extra: "drop" }],
        picUrl: "cover",
        privatePayload: "drop"
      },
      tracks: [record]
    } as unknown as NeteaseAlbum;
    const projectedAlbum = asObject(RendererTool.album(album));
    expect(projectedAlbum["privatePayload"]).toBeUndefined();
    expect(projectedAlbum["tracks"]).toHaveLength(1);

    const artist = {
      id: 201,
      name: "Artist",
      detail: { artist: { albumSize: 2, musicSize: 3, mvSize: 4, secret: "drop" } },
      desc: { briefDesc: "Brief", introduction: [{ ti: "Intro", txt: "Text" }] },
      followInfos: { fansCount: 10, irrelevant: "drop" },
      hotTracks: [record]
    } as unknown as NeteaseArtist;
    const projectedArtist = asObject(RendererTool.artist(artist));
    expect(projectedArtist["albumCount"]).toBe(2);
    expect(asObject(projectedArtist["follow"]!)["irrelevant"]).toBeUndefined();

    const playlist = {
      id: 601,
      name: "Playlist",
      description: "Description",
      coverImgUrl: "cover",
      creator: { userId: 1, nickname: "User", avatarUrl: "avatar", signature: "sig" },
      tags: ["tag"],
      highQuality: false,
      privacy: 0,
      subscribed: true,
      playCount: 20,
      subscribedCount: 3,
      commentCount: 2,
      shareCount: 1,
      trackCount: 1,
      playlistType: "NORMAL",
      createTime: 1,
      updateTime: 2,
      trackIds: [101],
      tracks: [track]
    } as unknown as NeteasePlaylist;
    const projectedPlaylist = asObject(RendererTool.playlist(playlist));
    expect(projectedPlaylist["trackIds"]).toBeUndefined();
    expect(projectedPlaylist["tracks"]).toHaveLength(1);
  });

  it("reports list and text truncation in _meta", () => {
    const list = asObject(
      RendererTool.list([1, 2, 3, 4], (value) => value, {
        maxItems: 2
      })
    );
    expect(list["items"]).toEqual([1, 2]);
    expect(asObject(list["_meta"]!)["truncated"]).toBe(true);

    const text = asObject(RendererTool.text("x".repeat(100), { maxTextChars: 12 }));
    expect((text["text"] as string).length).toBe(12);
    expect(asObject(text["_meta"]!)["truncated"]).toBe(true);
  });

  it("does not re-project an already projected semantic result", () => {
    const projected = RendererTool.list(
      Array.from({ length: 30 }, (_, index) => index),
      (value) => value,
      { maxItems: 30 }
    );

    expect(asObject(RendererTool.output(projected))["items"]).toHaveLength(30);
  });

  it("redacts credential tokens without hiding ordinary token counters", () => {
    const projected = asObject(
      RendererTool.output({
        apiKey: "secret-key",
        accessToken: "secret-token",
        contextWindowTokens: 1_000_000,
        inputTokens: 1_234,
        outputTokens: 567
      })
    );

    expect(projected["apiKey"]).toBe("[已脱敏]");
    expect(projected["accessToken"]).toBe("[已脱敏]");
    expect(projected["contextWindowTokens"]).toBe(1_000_000);
    expect(projected["inputTokens"]).toBe(1_234);
    expect(projected["outputTokens"]).toBe(567);
  });

  it("keeps oversized output valid JSON and inside the requested hard budget", () => {
    const result = RendererTool.output(
      {
        apiKey: "must-not-leak",
        rows: Array.from({ length: 200 }, (_, index) => ({
          index,
          text: "value".repeat(1_000)
        }))
      },
      {
        maxItems: 200,
        maxKeys: 100,
        maxTextChars: 20_000,
        totalChars: 1_024
      }
    );
    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThanOrEqual(1_024);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).not.toContain("must-not-leak");
    expect(asObject(asObject(result)["_meta"]!)["truncated"]).toBe(true);
  });

  it("歌词分析默认移除逐字时间轴，并保留显式可编辑模式", () => {
    const lyric = {
      id: 101,
      tips: "",
      rmExisted: true,
      tlExisted: true,
      noteExisted: false,
      data: Array.from({ length: 200 }, (_, lineIndex) => ({
        startTime: lineIndex * 1_000,
        endTime: lineIndex * 1_000 + 999,
        translatedLyric: "translation".repeat(20),
        romanLyric: "roman".repeat(20),
        isBlank: false,
        isBackChorus: false,
        words: Array.from({ length: 40 }, (_, wordIndex) => ({
          startTime: wordIndex * 10,
          endTime: wordIndex * 10 + 9,
          word: `word-${lineIndex}-${wordIndex}`
        }))
      }))
    } as unknown as NeteaseLyric;

    const semantic = RendererTool.lyric(lyric);
    const editable = RendererTool.lyric(lyric, "editable");
    const semanticText = JSON.stringify(semantic);
    const editableText = JSON.stringify(editable);
    const semanticResult = asObject(semantic);
    const firstLine = asObject((semanticResult["data"] as JsonValue[])[0]!);

    expect(semanticText.length).toBeLessThanOrEqual(12_000);
    expect(semanticText.length).toBeLessThan(editableText.length / 2);
    expect(semanticResult["rmExisted"]).toBe(true);
    expect(semanticResult["tlExisted"]).toBe(true);
    expect(firstLine["text"]).toContain("word-0-0");
    expect(firstLine["words"]).toBeUndefined();
    expect(editableText.length).toBeLessThanOrEqual(RendererTool.maxResultChars);
    expect(asObject(asObject(editable)["_meta"]!)["truncated"]).toBe(true);
  });

  it("只把评论正文和分析所需字段交给 Agent", () => {
    const payload = {
      message: "",
      data: {
        cursor: "next-page",
        hasMore: true,
        sortType: 2,
        totalCount: 8_888,
        commentsTitle: "热门评论",
        comments: Array.from({ length: 20 }, (_, index) => ({
          commentId: 10_000 + index,
          parentCommentId: 0,
          content: `第 ${index + 1} 条听众观点：${"情绪与剧情的联想。".repeat(12)}`,
          time: 1_700_000_000_000 + index,
          timeStr: `${index + 1} 天前`,
          liked: index === 0,
          likedCount: 100 - index,
          replyCount: index,
          owner: false,
          highlight: index === 0,
          userTop: false,
          ipLocation: { ip: null, location: "上海", userId: null },
          user: {
            userId: 20_000 + index,
            nickname: `用户 ${index + 1}`,
            avatarUrl: `https://example.test/${"avatar".repeat(100)}`,
            vipRights: {
              associator: { iconUrl: "vip-icon".repeat(100), rights: true, vipCode: 11 },
              extInfo: { logo: { logoDto: { url: "logo".repeat(100) } } }
            }
          },
          decoration: { animatedBadge: "animation".repeat(300) },
          likeAnimationMap: { COMMENT_AREA: ["frame".repeat(300)] }
        }))
      }
    };

    const result = RendererTool.comments(payload);
    const serialized = JSON.stringify(result);
    const projected = asObject(result);
    const firstComment = asObject((projected["comments"] as JsonValue[])[0]!);

    expect(serialized.length).toBeLessThanOrEqual(12_000);
    expect(serialized.length).toBeLessThan(JSON.stringify(payload).length / 4);
    expect(projected["comments"]).toHaveLength(20);
    expect(firstComment["content"]).toContain("听众观点");
    expect(asObject(firstComment["user"]!)).toEqual({ id: 20_000, nickname: "用户 1" });
    expect(serialized).not.toContain("avatarUrl");
    expect(serialized).not.toContain("vipRights");
    expect(serialized).not.toContain("likeAnimationMap");
  });

  it("把搜索响应投影为可消歧的轻量资源列表", () => {
    const payload = {
      songCount: 100,
      hasMore: true,
      songs: Array.from({ length: 20 }, (_, index) => ({
        id: 1_000 + index,
        name: `歌曲 ${index}`,
        alias: [`别名 ${index}`],
        duration: 180_000,
        fee: 0,
        artists: [
          {
            id: 2_000 + index,
            name: `艺人 ${index}`,
            img1v1Url: "avatar".repeat(500),
            albumSize: 999,
            musicSize: 999
          }
        ],
        album: {
          id: 3_000 + index,
          name: `专辑 ${index}`,
          picUrl: "cover".repeat(500),
          artist: { privateData: "drop" }
        },
        privilege: { chargeInfoList: Array.from({ length: 100 }, () => ({ rate: 999_000 })) }
      }))
    };

    const result = RendererTool.search(payload, "track");
    const serialized = JSON.stringify(result);
    const projected = asObject(result);
    const first = asObject((projected["items"] as JsonValue[])[0]!);

    expect(serialized.length).toBeLessThanOrEqual(12_000);
    expect(serialized.length).toBeLessThan(JSON.stringify(payload).length / 5);
    expect(projected).toMatchObject({ type: "track", total: 100, returnedCount: 20 });
    expect(first["id"]).toBe(1_000);
    expect(first["name"]).toBe("歌曲 0");
    expect(asObject((first["artists"] as JsonValue[])[0]!)).toEqual({
      id: 2_000,
      name: "艺人 0"
    });
    expect(asObject(first["album"]!)).toEqual({ id: 3_000, name: "专辑 0" });
    expect(serialized).not.toContain("privilege");
    expect(serialized).not.toContain("img1v1Url");
  });
});
