import type { LLMToolOutputDetail } from "@mahiru/ai";
import type {
  NeteaseAlbum,
  NeteaseLyric,
  NeteaseTrack,
  NeteaseArtist,
  NeteasePlaylist,
  NeteaseTrackRecord
} from "@/common/netease/models";

type JsonObject = { [key: string]: JsonValue };

type RendererToolSearchPage = {
  page: number;
  pageSize: number;
};

export type RendererToolTruncation = {
  path: string;
  originalChars?: number;
  originalCount?: number;
  returnedChars?: number;
  returnedCount?: number;
  kind: "list" | "text" | "depth" | "budget" | "object" | "circular" | "redacted";
};

export type RendererToolMeta = {
  truncated: boolean;
  budgetChars: number;
  truncations?: RendererToolTruncation[];
};

export type RendererToolProjectionOptions = {
  maxKeys?: number;
  maxDepth?: number;
  maxItems?: number;
  totalChars?: number;
  maxTextChars?: number;
};

export type RendererToolDetail = LLMToolOutputDetail;

type ProjectionLimits = Required<RendererToolProjectionOptions>;

const CompactProjectionLimits: ProjectionLimits = {
  maxDepth: 5,
  maxItems: 8,
  maxKeys: 24,
  maxTextChars: 1_200,
  totalChars: 4_000
};

const DefaultProjectionLimits: ProjectionLimits = {
  maxDepth: 6,
  maxItems: 20,
  maxKeys: 40,
  maxTextChars: 2_500,
  totalChars: 8_000
};

const MaximumProjectionLimits: ProjectionLimits = {
  maxDepth: 10,
  maxItems: 120,
  maxKeys: 120,
  maxTextChars: 16_000,
  totalChars: 24_000
};

const DetailProjectionLimits: Record<RendererToolDetail, ProjectionLimits> = {
  compact: CompactProjectionLimits,
  standard: DefaultProjectionLimits,
  detailed: {
    maxDepth: 8,
    maxItems: 60,
    maxKeys: 80,
    maxTextChars: 8_000,
    totalChars: 16_000
  }
};

const MinimumProjectionLimits: ProjectionLimits = {
  maxDepth: 2,
  maxItems: 1,
  maxKeys: 4,
  maxTextChars: 1,
  totalChars: 512
};

const SensitiveKeys = new Set([
  "accesstoken",
  "apikey",
  "apitoken",
  "authtoken",
  "bearertoken",
  "clientsecret",
  "cookie",
  "credentials",
  "credential",
  "authorization",
  "password",
  "refreshtoken",
  "sessiontoken",
  "setcookie",
  "secret",
  "token"
]);
const MaxTruncationDetails = 16;

class ProjectionState {
  readonly truncations: RendererToolTruncation[] = [];

  add(truncation: RendererToolTruncation) {
    if (this.truncations.length >= MaxTruncationDetails) return;
    this.truncations.push(truncation);
  }

  get truncated() {
    return this.truncations.length > 0;
  }
}

/**
 * Agent 工具在渲染进程中的输出边界。
 *
 * RendererFormat 负责给人看的文字格式；RendererTool 负责给模型的语义投影、
 * 脱敏和大小预算。所有公开结果都保持为可结构化克隆的有效 JsonValue。
 */
export class RendererTool {
  static readonly maxResultChars = MaximumProjectionLimits.totalChars;
  static readonly defaultResultChars = DefaultProjectionLimits.totalChars;
  private static readonly projectedValues = new WeakSet<object>();

  static options(
    detail: RendererToolDetail = "standard",
    overrides: RendererToolProjectionOptions = {}
  ): RendererToolProjectionOptions {
    const profile = DetailProjectionLimits[detail];
    return { ...profile, ...overrides };
  }

  static output(
    value: unknown,
    options?: RendererToolDetail | RendererToolProjectionOptions
  ): JsonValue {
    const resolved = resolveProjectionOptions(options);
    if (isObjectLike(value) && this.projectedValues.has(value)) {
      return value as JsonValue;
    }
    return this.project(value, resolved);
  }

  static text(value: unknown, options?: RendererToolProjectionOptions): JsonValue {
    return this.project({ text: value == null ? "" : String(value) }, options);
  }

  static list<T>(
    values: readonly T[],
    mapper: (value: T, index: number) => unknown = (value) => value,
    options?: RendererToolProjectionOptions
  ): JsonValue {
    const limits = normalizeLimits(options ?? {});
    const selected = values.slice(0, limits.maxItems);
    const truncated = selected.length < values.length;
    return this.project(
      {
        items: selected.map(mapper),
        ...(truncated
          ? {
              _meta: {
                truncated: true,
                budgetChars: limits.totalChars,
                truncations: [
                  {
                    kind: "list",
                    path: "$.items",
                    originalCount: values.length,
                    returnedCount: selected.length
                  }
                ]
              }
            }
          : {})
      },
      options,
      truncated
    );
  }

  static object(value: unknown, options?: RendererToolProjectionOptions): JsonValue {
    return this.project(value, options);
  }

  /**
   * 评论接口包含头像、会员权益、装饰和动画等大量界面字段；Agent 只需要评论正文、
   * 作者、时间、热度及回复关系。这里保留完整一页的有效评论，同时限制极端长文本。
   */
  static comments(value: unknown, detail: RendererToolDetail = "standard"): JsonValue {
    const response = asRecord(value);
    const page = asRecord(response["data"] ?? response);
    const comments = Array.isArray(page["comments"]) ? page["comments"] : [];

    return this.project(
      compactObject({
        message: response["message"],
        cursor: page["cursor"],
        hasMore: page["hasMore"],
        sortType: page["sortType"],
        totalCount: page["totalCount"],
        commentsTitle: page["commentsTitle"],
        comments: comments.map(compactComment)
      }),
      this.options(detail, {
        maxDepth: 6,
        maxItems: Math.min(40, DetailProjectionLimits[detail].maxItems),
        maxKeys: 24,
        maxTextChars: DetailProjectionLimits[detail].maxTextChars
      })
    );
  }

  /** 搜索只用于消歧和取得资源 ID，不向模型转发封面权限、版权对象等界面字段。 */
  static search(
    value: unknown,
    type: "album" | "track" | "artist" | "playlist",
    pagination?: RendererToolSearchPage,
    detail: RendererToolDetail = "standard"
  ): JsonValue {
    const result = asRecord(value);
    const projected = compactSearchResult(result, type, pagination);
    return this.project(
      projected,
      this.options(detail, {
        maxDepth: 5,
        maxItems: Math.min(40, DetailProjectionLimits[detail].maxItems),
        maxKeys: 20,
        maxTextChars: Math.min(2_400, DetailProjectionLimits[detail].maxTextChars)
      })
    );
  }

  static track(
    track: NeteaseTrack,
    mode: "detail" | "simple" = "simple",
    detail: RendererToolDetail = "standard"
  ): JsonValue {
    return this.project(this.trackData(track, mode), this.options(detail));
  }

  static record(record: NeteaseTrackRecord, detail: RendererToolDetail = "standard"): JsonValue {
    return this.project(this.recordData(record), this.options(detail));
  }

  static album(album: NeteaseAlbum, detail: RendererToolDetail = "standard"): JsonValue {
    const content = asRecord(album.content);
    const rawArtists = content["artists"] ?? content["artist"];
    const artists = Array.isArray(rawArtists)
      ? rawArtists.map(compactArtistReference)
      : rawArtists
        ? [compactArtistReference(rawArtists)]
        : [];

    return this.project(
      compactObject({
        id: content["id"],
        name: content["name"],
        aliases: content["alias"] ?? content["aliases"] ?? content["alia"],
        artists,
        company: content["company"],
        description: content["description"] ?? content["briefDesc"],
        coverUrl: content["picUrl"] ?? content["blurPicUrl"],
        publishedAt: content["publishTime"],
        trackCount: content["size"] ?? album.tracks.length,
        tracks: album.tracks.map((record) => this.recordData(record))
      }),
      this.options(detail, {
        maxItems: Math.min(60, DetailProjectionLimits[detail].maxItems),
        maxTextChars: DetailProjectionLimits[detail].maxTextChars
      })
    );
  }

  static artist(artist: NeteaseArtist, detail: RendererToolDetail = "standard"): JsonValue {
    const artistDetail = asRecord(artist.detail);
    const detailArtist = asRecord(artistDetail["artist"] ?? artistDetail);
    const desc = asRecord(artist.desc);
    const introductions = Array.isArray(desc["introduction"])
      ? desc["introduction"].map((item) => {
          const introduction = asRecord(item);
          return compactObject({
            title: introduction["ti"] ?? introduction["title"],
            text: introduction["txt"] ?? introduction["text"]
          });
        })
      : [];

    return this.project(
      compactObject({
        id: artist.id,
        name: artist.name,
        aliases: detailArtist["alias"] ?? detailArtist["aliases"],
        coverUrl: detailArtist["cover"] ?? detailArtist["picUrl"] ?? artistDetail["cover"],
        avatarUrl: detailArtist["avatar"] ?? detailArtist["img1v1Url"],
        briefDescription: desc["briefDesc"] ?? detailArtist["briefDesc"],
        albumCount: detailArtist["albumSize"],
        trackCount: detailArtist["musicSize"],
        mvCount: detailArtist["mvSize"],
        introductions,
        follow: compactSelectedFields(artist.followInfos, [
          "fansCount",
          "followCount",
          "followed",
          "follows",
          "identifyTag"
        ]),
        hotTracks: artist.hotTracks.map((record) => this.recordData(record))
      }),
      this.options(detail, {
        maxItems: Math.min(40, DetailProjectionLimits[detail].maxItems),
        maxTextChars: DetailProjectionLimits[detail].maxTextChars
      })
    );
  }

  static playlist(playlist: NeteasePlaylist, detail: RendererToolDetail = "standard"): JsonValue {
    return this.project(
      compactObject({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.coverImgUrl,
        creator: compactSelectedFields(playlist.creator, [
          "userId",
          "nickname",
          "avatarUrl",
          "signature"
        ]),
        tags: playlist.tags,
        highQuality: playlist.highQuality,
        privacy: playlist.privacy,
        subscribed: playlist.subscribed,
        playCount: playlist.playCount,
        subscribedCount: playlist.subscribedCount,
        commentCount: playlist.commentCount,
        shareCount: playlist.shareCount,
        trackCount: playlist.trackCount,
        playlistType: playlist.playlistType,
        createdAt: playlist.createTime,
        updatedAt: playlist.updateTime,
        tracks: playlist.tracks.map((track) => this.trackData(track, "simple"))
      }),
      this.options(detail, {
        maxItems: Math.min(60, DetailProjectionLimits[detail].maxItems),
        maxTextChars: DetailProjectionLimits[detail].maxTextChars
      })
    );
  }

  static lyric(
    lyric: NeteaseLyric,
    mode: "editable" | "semantic" = "semantic",
    detail: RendererToolDetail = "standard"
  ): JsonValue {
    if (mode === "semantic") {
      return this.project(
        {
          data: lyric.data.map((line) => {
            const inlineNote = line.words
              .filter((word) => word.inlineNote)
              .map((word) => word.word)
              .join("");
            return compactObject({
              startTime: line.startTime,
              endTime: line.endTime,
              text: line.words.map((word) => word.word).join(""),
              ...(line.translatedLyric ? { translatedLyric: line.translatedLyric } : {}),
              ...(line.romanLyric ? { romanLyric: line.romanLyric } : {}),
              ...(inlineNote ? { inlineNote } : {}),
              ...(line.isBlank ? { isBlank: true } : {}),
              ...(line.isBackChorus ? { isBackChorus: true } : {})
            });
          }),
          id: lyric.id ?? null,
          rmExisted: lyric.rmExisted,
          tlExisted: lyric.tlExisted,
          noteExisted: lyric.noteExisted,
          tips: lyric.tips
        },
        this.options(detail, {
          maxDepth: 5,
          maxItems: Math.min(120, DetailProjectionLimits[detail].maxItems * 3),
          maxKeys: 20,
          maxTextChars: 1_024,
          totalChars: detail === "compact" ? 4_000 : detail === "detailed" ? 16_000 : 5_500
        })
      );
    }

    return this.project(
      {
        data: lyric.data.map((line) => ({
          words: line.words.map((word) => ({
            startTime: word.startTime,
            endTime: word.endTime,
            word: word.word,
            ...(word.inlineNote === undefined ? {} : { inlineNote: word.inlineNote })
          })),
          translatedLyric: line.translatedLyric ?? "",
          romanLyric: line.romanLyric ?? "",
          startTime: line.startTime,
          endTime: line.endTime,
          isBlank: line.isBlank ?? false,
          isBackChorus: line.isBackChorus ?? false
        })),
        id: lyric.id ?? null,
        rmExisted: lyric.rmExisted,
        tlExisted: lyric.tlExisted,
        noteExisted: lyric.noteExisted,
        tips: lyric.tips
      },
      this.options(detail, {
        maxDepth: 8,
        maxItems: Math.min(120, DetailProjectionLimits[detail].maxItems * 6),
        maxKeys: 40,
        maxTextChars: 1_024,
        // editable 已经是显式高信息场景；24K 上限与 AI 侧单结果、近期保留预算一致。
        totalChars: detail === "compact" ? 10_000 : MaximumProjectionLimits.totalChars
      })
    );
  }

  private static trackData(track: NeteaseTrack, mode: "detail" | "simple"): JsonObject {
    const album = asRecord(track.al);
    const base = compactObject({
      id: track.id,
      name: track.name,
      artists: track.ar.map(compactArtistReference),
      album: compactObject({
        id: album["id"],
        name: album["name"],
        coverUrl: album["picUrl"],
        aliases: album["alias"] ?? album["alia"],
        translatedNames: album["tns"]
      }),
      aliases: track.alia,
      translatedNames: track.tns
    });
    if (mode === "simple") return base;

    return compactObject({
      ...base,
      durationMs: track.dt,
      publishedAt: track.publishTime,
      trackNumber: track.no,
      popularity: track.pop,
      fee: track.fee,
      mvId: track.mv,
      qualities: compactObject({
        highResolution: compactQuality(track.hr),
        lossless: compactQuality(track.sq),
        high: compactQuality(track.h),
        medium: compactQuality(track.m),
        low: compactQuality(track.l)
      })
    });
  }

  private static recordData(record: NeteaseTrackRecord): JsonObject {
    return compactObject({
      id: record.id,
      name: record.name,
      source: {
        id: record.sourceID,
        type: record.sourceName
      },
      track: this.trackData(record.detail, "simple")
    });
  }

  private static project(
    value: unknown,
    options: RendererToolProjectionOptions = {},
    alwaysMeta = false
  ): JsonValue {
    const requestedLimits = normalizeLimits(options);
    let limits = requestedLimits;
    let budgetReduced = false;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const state = new ProjectionState();
      if (budgetReduced) state.add({ kind: "budget", path: "$" });
      const projected = projectValue(value, limits, state, "$", 0, new WeakSet<object>());
      const result = wrapResult(projected, state, requestedLimits.totalChars, alwaysMeta);
      if (jsonLength(result) <= requestedLimits.totalChars) return this.remember(result);

      budgetReduced = true;
      limits = reduceLimits(limits, requestedLimits.totalChars);
    }

    return this.remember({
      value: "[工具结果超出预算，内容已省略]",
      _meta: {
        truncated: true,
        budgetChars: requestedLimits.totalChars,
        truncations: [{ kind: "budget", path: "$" }]
      }
    });
  }

  private static remember<T extends JsonValue>(value: T): T {
    if (isObjectLike(value)) this.projectedValues.add(value);
    return value;
  }
}

function resolveProjectionOptions(
  options?: RendererToolDetail | RendererToolProjectionOptions
): RendererToolProjectionOptions {
  return typeof options === "string" ? RendererTool.options(options) : (options ?? {});
}

function normalizeLimits(options: RendererToolProjectionOptions): ProjectionLimits {
  return {
    maxDepth: clampInteger(
      options.maxDepth,
      MinimumProjectionLimits.maxDepth,
      MaximumProjectionLimits.maxDepth,
      DefaultProjectionLimits.maxDepth
    ),
    maxItems: clampInteger(
      options.maxItems,
      MinimumProjectionLimits.maxItems,
      MaximumProjectionLimits.maxItems,
      DefaultProjectionLimits.maxItems
    ),
    maxKeys: clampInteger(
      options.maxKeys,
      MinimumProjectionLimits.maxKeys,
      MaximumProjectionLimits.maxKeys,
      DefaultProjectionLimits.maxKeys
    ),
    maxTextChars: clampInteger(
      options.maxTextChars,
      MinimumProjectionLimits.maxTextChars,
      MaximumProjectionLimits.maxTextChars,
      DefaultProjectionLimits.maxTextChars
    ),
    totalChars: clampInteger(
      options.totalChars,
      MinimumProjectionLimits.totalChars,
      MaximumProjectionLimits.totalChars,
      DefaultProjectionLimits.totalChars
    )
  };
}

function reduceLimits(limits: ProjectionLimits, totalChars: number): ProjectionLimits {
  return {
    totalChars,
    // 超出总预算时优先减少条目、字段和长文本，不能把仍被保留的语义对象压成空壳。
    maxDepth: limits.maxDepth,
    maxItems: Math.max(MinimumProjectionLimits.maxItems, Math.floor(limits.maxItems * 0.65)),
    maxKeys: Math.max(MinimumProjectionLimits.maxKeys, Math.floor(limits.maxKeys * 0.7)),
    maxTextChars: Math.max(
      MinimumProjectionLimits.maxTextChars,
      Math.floor(limits.maxTextChars * 0.55)
    )
  };
}

function projectValue(
  value: unknown,
  limits: ProjectionLimits,
  state: ProjectionState,
  path: string,
  depth: number,
  seen: WeakSet<object>
): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return projectText(value, limits.maxTextChars, state, path);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return projectValue(
      { name: value.name, message: value.message },
      limits,
      state,
      path,
      depth,
      seen
    );
  }

  if (depth >= limits.maxDepth) {
    state.add({ kind: "depth", path });
    return Array.isArray(value) ? [] : {};
  }

  if (seen.has(value)) {
    state.add({ kind: "circular", path });
    return "[循环引用已省略]";
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const selected = value.slice(0, limits.maxItems);
      if (selected.length < value.length) {
        state.add({
          kind: "list",
          path,
          originalCount: value.length,
          returnedCount: selected.length
        });
      }
      return selected.map((item, index) =>
        projectValue(item, limits, state, `${path}[${index}]`, depth + 1, seen)
      );
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const selected = entries.slice(0, limits.maxKeys);
    if (selected.length < entries.length) {
      state.add({
        kind: "object",
        path,
        originalCount: entries.length,
        returnedCount: selected.length
      });
    }

    const result: JsonObject = {};
    for (const [key, item] of selected) {
      const itemPath = `${path}.${key}`;
      if (isSensitiveKey(key)) {
        result[key] = "[已脱敏]";
        state.add({ kind: "redacted", path: itemPath });
        continue;
      }
      result[key] = projectValue(item, limits, state, itemPath, depth + 1, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function isSensitiveKey(key: string) {
  return SensitiveKeys.has(key.replace(/[-_\s]/g, "").toLowerCase());
}

function projectText(value: string, maxChars: number, state: ProjectionState, path: string) {
  if (value.length <= maxChars) return value;
  const suffix = maxChars > 1 ? "…" : "";
  const projected = `${value.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`;
  state.add({
    kind: "text",
    path,
    originalChars: value.length,
    returnedChars: projected.length
  });
  return projected;
}

function wrapResult(
  value: JsonValue,
  state: ProjectionState,
  budgetChars: number,
  alwaysMeta: boolean
): JsonValue {
  if (!alwaysMeta && !state.truncated) return value;

  const meta = createMeta(value, state, budgetChars);
  if (Array.isArray(value)) return { items: value, _meta: meta };
  if (!isJsonObject(value)) return { value, _meta: meta };

  const rawExistingMeta = value["_meta"];
  const existingMeta =
    rawExistingMeta !== undefined && isJsonObject(rawExistingMeta) ? rawExistingMeta : null;
  const { _meta: _ignored, ...rest } = value;
  void _ignored;
  if (!existingMeta) return { ...rest, _meta: meta };

  return {
    ...rest,
    _meta: {
      ...existingMeta,
      ...meta,
      truncated: existingMeta["truncated"] === true || meta.truncated
    }
  };
}

function createMeta(
  value: JsonValue,
  state: ProjectionState,
  budgetChars: number
): RendererToolMeta {
  let priorTruncated = false;
  let priorTruncations: RendererToolTruncation[] = [];
  const rawMeta = isJsonObject(value) ? value["_meta"] : undefined;
  if (rawMeta !== undefined && isJsonObject(rawMeta)) {
    priorTruncated = rawMeta["truncated"] === true;
    if (Array.isArray(rawMeta["truncations"])) {
      priorTruncations = rawMeta["truncations"].filter(isRendererToolTruncation);
    }
  }
  const truncations = [...priorTruncations, ...state.truncations].slice(0, MaxTruncationDetails);
  return {
    truncated: priorTruncated || state.truncated,
    budgetChars,
    ...(truncations.length ? { truncations } : {})
  };
}

function isRendererToolTruncation(value: JsonValue): value is RendererToolTruncation {
  return (
    isJsonObject(value) && typeof value["kind"] === "string" && typeof value["path"] === "string"
  );
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function jsonLength(value: JsonValue) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function compactObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as JsonObject;
}

function compactArtistReference(value: unknown): JsonObject {
  const artist = asRecord(value);
  return compactObject({
    id: artist["id"],
    name: artist["name"],
    aliases: artist["alias"] ?? artist["aliases"] ?? artist["alia"],
    translatedNames: artist["tns"]
  });
}

function compactQuality(value: unknown): undefined | JsonObject {
  if (!value || typeof value !== "object") return undefined;
  return compactSelectedFields(value, ["br", "size", "sr", "vd"]);
}

function compactSelectedFields(value: unknown, keys: readonly string[]): JsonObject {
  const record = asRecord(value);
  return compactObject(
    Object.fromEntries(
      keys.flatMap((key) => (record[key] === undefined ? [] : [[key, record[key]]]))
    )
  );
}

function compactComment(value: unknown): JsonObject {
  const comment = asRecord(value);
  const user = asRecord(comment["user"]);
  const location = asRecord(comment["ipLocation"])["location"];
  const replies = Array.isArray(comment["beReplied"])
    ? comment["beReplied"].slice(0, 3).map((reply) => {
        const item = asRecord(reply);
        const replyUser = asRecord(item["user"]);
        return compactObject({
          commentId: item["beRepliedCommentId"] ?? item["commentId"],
          content: item["content"],
          user: compactObject({
            id: replyUser["userId"],
            nickname: replyUser["nickname"]
          })
        });
      })
    : undefined;

  return compactObject({
    commentId: comment["commentId"],
    parentCommentId: comment["parentCommentId"],
    content: comment["content"],
    time: comment["time"],
    timeLabel: comment["timeStr"],
    liked: comment["liked"],
    likedCount: comment["likedCount"],
    replyCount: comment["replyCount"],
    owner: comment["owner"],
    highlighted: comment["highlight"],
    pinnedByUser: comment["userTop"],
    ...(typeof location === "string" && location ? { location } : {}),
    user: compactObject({
      id: user["userId"],
      nickname: user["nickname"]
    }),
    replies
  });
}

function compactSearchResult(
  result: Record<string, unknown>,
  type: "album" | "track" | "artist" | "playlist",
  pagination?: RendererToolSearchPage
): JsonObject {
  const config = {
    track: { count: "songCount", list: "songs", map: compactSearchTrack },
    album: { count: "albumCount", list: "albums", map: compactSearchAlbum },
    artist: { count: "artistCount", list: "artists", map: compactSearchArtist },
    playlist: { count: "playlistCount", list: "playlists", map: compactSearchPlaylist }
  }[type];
  const candidateItems = result[config.list];
  const rawItems: unknown[] = Array.isArray(candidateItems) ? candidateItems : [];
  const items = rawItems.slice(0, 20).map(config.map);
  const total = result[config.count];
  const hasMore =
    typeof result["hasMore"] === "boolean"
      ? result["hasMore"]
      : pagination && typeof total === "number"
        ? pagination.page * pagination.pageSize < total
        : pagination
          ? rawItems.length >= pagination.pageSize
          : rawItems.length > items.length;
  return compactObject({
    type,
    items,
    total,
    ...(pagination ? pagination : {}),
    returnedCount: items.length,
    hasMore
  });
}

function compactSearchTrack(value: unknown): JsonObject {
  const track = asRecord(value);
  const album = asRecord(track["album"] ?? track["al"]);
  const artists = Array.isArray(track["artists"] ?? track["ar"])
    ? ((track["artists"] ?? track["ar"]) as unknown[]).map(compactArtistReference)
    : [];
  return compactObject({
    id: track["id"],
    name: track["name"],
    aliases: track["alias"] ?? track["alia"] ?? track["transNames"],
    durationMs: track["duration"] ?? track["dt"],
    fee: track["fee"],
    artists,
    album: compactObject({
      id: album["id"],
      name: album["name"],
      aliases: album["alia"] ?? album["alias"] ?? album["transNames"]
    })
  });
}

function compactSearchAlbum(value: unknown): JsonObject {
  const album = asRecord(value);
  const rawArtists = Array.isArray(album["artists"])
    ? album["artists"]
    : album["artist"]
      ? [album["artist"]]
      : [];
  return compactObject({
    id: album["id"],
    name: album["name"],
    aliases: album["alias"] ?? album["alia"] ?? album["transNames"],
    type: album["type"],
    trackCount: album["size"],
    publishedAt: album["publishTime"],
    company: album["company"],
    artists: rawArtists.map(compactArtistReference)
  });
}

function compactSearchArtist(value: unknown): JsonObject {
  const artist = asRecord(value);
  return compactObject({
    id: artist["id"],
    name: artist["name"],
    aliases: artist["alias"] ?? artist["alia"],
    albumCount: artist["albumSize"],
    trackCount: artist["musicSize"],
    mvCount: artist["mvSize"],
    followed: artist["followed"]
  });
}

function compactSearchPlaylist(value: unknown): JsonObject {
  const playlist = asRecord(value);
  const creator = asRecord(playlist["creator"]);
  return compactObject({
    id: playlist["id"],
    name: playlist["name"],
    description: playlist["description"],
    trackCount: playlist["trackCount"],
    playCount: playlist["playCount"],
    subscribed: playlist["subscribed"],
    highQuality: playlist["highQuality"],
    creator: compactObject({
      id: creator["userId"],
      nickname: creator["nickname"]
    })
  });
}
