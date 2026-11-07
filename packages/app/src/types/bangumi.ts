import { z } from "zod";

/**
 * Bangumi 公开 API 的完整模型：接口原始数据与工具输出各有一套 schema，类型统一由 z.infer 派生。
 * 官方把搜索接口标为实验性，所以原始数据的每个字段都单独兜底（.catch），单点类型漂移不会让整条数据作废。
 */

// ---------- 枚举 ----------

/** 搜索对象：条目 / 角色 / 人物 */
export const BangumiSearchKindSchema = z.enum(["subject", "character", "person"]);
export type BangumiSearchKind = z.infer<typeof BangumiSearchKindSchema>;

export const BangumiSortSchema = z.enum(["match", "heat", "rank", "score"]);
export type BangumiSort = z.infer<typeof BangumiSortSchema>;

/** 条目类型；接口用数字 1/2/3/4/6 表示，没有 5 */
export const BangumiSubjectKindSchema = z.enum(["anime", "music", "book", "game", "real"]);
export type BangumiSubjectKind = z.infer<typeof BangumiSubjectKindSchema>;

/** 人物职业过滤，取值来自接口的 PersonCareer */
export const BangumiCareerSchema = z.enum([
  "artist",
  "seiyu",
  "producer",
  "mangaka",
  "writer",
  "illustrator",
  "actor"
]);
export type BangumiCareer = z.infer<typeof BangumiCareerSchema>;

/** 详情可以追加的关联数据 */
export const BangumiIncludeSchema = z.enum(["characters", "staff", "works", "actors", "roles"]);
export type BangumiInclude = z.infer<typeof BangumiIncludeSchema>;

// ---------- 接口原始数据 ----------

/** 字段级兜底：类型不符或为 null 时退化为 undefined，不影响同一对象的其他字段。 */
const text = z.string().trim().optional().catch(undefined);
const count = z.number().optional().catch(undefined);
const flag = z.boolean().optional().catch(undefined);

/** 逐条解析并丢弃不合格项：一条脏数据不该让整个数组失效。 */
function list<T>(schema: z.ZodType<T>) {
  return z
    .array(z.unknown())
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = schema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      })
    )
    .catch([]);
}

export const BangumiImageSchema = z
  .object({
    large: text,
    medium: text,
    common: text,
    small: text,
    grid: text
  })
  .optional()
  .catch(undefined);
export type BangumiImage = z.infer<typeof BangumiImageSchema>;

export const BangumiInfoboxItemSchema = z.object({
  key: z.string().trim(),
  value: z.union([z.string(), list(z.object({ k: text, v: text }))]).optional()
});
export const BangumiInfoboxSchema = list(BangumiInfoboxItemSchema);
export type BangumiInfoboxItem = z.infer<typeof BangumiInfoboxItemSchema>;

export const BangumiTagSchema = z.object({ name: z.string().trim() });
export const BangumiTagListSchema = list(BangumiTagSchema);
export type BangumiTag = z.infer<typeof BangumiTagSchema>;

export const BangumiStringListSchema = list(z.string().trim());

export const BangumiRatingSchema = z
  .object({
    rank: count,
    total: count,
    score: count,
    count: z.record(z.string(), z.number()).optional().catch(undefined)
  })
  .optional()
  .catch(undefined);

export const BangumiCollectionSchema = z
  .object({
    wish: count,
    collect: count,
    doing: count,
    on_hold: count,
    dropped: count
  })
  .optional()
  .catch(undefined);

export const BangumiStatSchema = z
  .object({ comments: count, collects: count })
  .optional()
  .catch(undefined);

export const BangumiBirthdaySchema = z.object({
  birth_year: count,
  birth_mon: count,
  birth_day: count
});

export const BangumiSubjectSchema = z.object({
  id: count,
  type: count,
  name: text,
  name_cn: text,
  date: text,
  platform: text,
  summary: text,
  image: text,
  eps: count,
  total_episodes: count,
  volumes: count,
  series: flag,
  images: BangumiImageSchema,
  infobox: BangumiInfoboxSchema,
  tags: BangumiTagListSchema,
  meta_tags: BangumiStringListSchema,
  rating: BangumiRatingSchema,
  collection: BangumiCollectionSchema
});
export type BangumiSubject = z.infer<typeof BangumiSubjectSchema>;

export const BangumiCharacterSchema = BangumiBirthdaySchema.extend({
  id: count,
  type: count,
  name: text,
  summary: text,
  blood_type: text,
  images: BangumiImageSchema,
  infobox: BangumiInfoboxSchema,
  stat: BangumiStatSchema
});
export type BangumiCharacter = z.infer<typeof BangumiCharacterSchema>;

export const BangumiPersonSchema = BangumiCharacterSchema.extend({
  career: BangumiStringListSchema
});
export type BangumiPerson = z.infer<typeof BangumiPersonSchema>;

/** 关联列表的每一行：条目下的角色/人物、角色出演的作品、声优与配音角色都用这个形状。 */
export const BangumiRelatedRowSchema = z.object({
  id: count,
  type: count,
  name: text,
  name_cn: text,
  relation: text,
  staff: text,
  actors: list(z.union([z.string().trim(), z.object({ name: z.string().trim() })]))
});
export const BangumiRelatedRowsSchema = list(BangumiRelatedRowSchema);
export type BangumiRelatedRow = z.infer<typeof BangumiRelatedRowSchema>;

/** 搜索响应的外层信封：即使整体结构异常也只退化成空列表。 */
export const BangumiSearchResponseSchema = z
  .object({
    data: z.array(z.unknown()).catch([]),
    total: count,
    limit: count,
    offset: count
  })
  .catch({ data: [] });
export type BangumiSearchResponse = z.infer<typeof BangumiSearchResponseSchema>;

// ---------- 工具输出 ----------

export const BangumiRelatedItemSchema = z.object({
  id: z.number(),
  url: z.string(),
  name: z.string(),
  type: z.string().optional(),
  nameCn: z.string().optional(),
  actors: z.array(z.string()).optional(),
  relation: z.string().optional()
});
export type BangumiRelatedItem = z.infer<typeof BangumiRelatedItemSchema>;

export const BangumiRelatedListSchema = z.object({
  total: z.number(),
  omitted: z.number().optional(),
  items: z.array(BangumiRelatedItemSchema)
});
export type BangumiRelatedList = z.infer<typeof BangumiRelatedListSchema>;

export const BangumiSubjectBriefSchema = z.object({
  id: z.number(),
  url: z.string(),
  name: z.string(),
  type: z.string(),
  date: z.string().optional(),
  rank: z.number().optional(),
  image: z.string().optional(),
  score: z.number().optional(),
  nameCn: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  platform: z.string().optional(),
  ratingCount: z.number().optional(),
  infobox: z.record(z.string(), z.string()).optional()
});
export type BangumiSubjectBrief = z.infer<typeof BangumiSubjectBriefSchema>;

export const BangumiSubjectDetailSchema = BangumiSubjectBriefSchema.extend({
  eps: z.number().optional(),
  series: z.boolean().optional(),
  volumes: z.number().optional(),
  metaTags: z.array(z.string()).optional(),
  totalEpisodes: z.number().optional(),
  staff: BangumiRelatedListSchema.optional(),
  characters: BangumiRelatedListSchema.optional(),
  collection: z.record(z.string(), z.number()).optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional()
});
export type BangumiSubjectDetail = z.infer<typeof BangumiSubjectDetailSchema>;

export const BangumiCharacterBriefSchema = z.object({
  id: z.number(),
  url: z.string(),
  name: z.string(),
  type: z.string(),
  image: z.string().optional(),
  nameCn: z.string().optional(),
  summary: z.string().optional(),
  infobox: z.record(z.string(), z.string()).optional()
});
export type BangumiCharacterBrief = z.infer<typeof BangumiCharacterBriefSchema>;

export const BangumiCharacterDetailSchema = BangumiCharacterBriefSchema.extend({
  birthday: z.string().optional(),
  bloodType: z.string().optional(),
  works: BangumiRelatedListSchema.optional(),
  actors: BangumiRelatedListSchema.optional(),
  stat: z.record(z.string(), z.number()).optional()
});
export type BangumiCharacterDetail = z.infer<typeof BangumiCharacterDetailSchema>;

export const BangumiPersonBriefSchema = z.object({
  id: z.number(),
  url: z.string(),
  name: z.string(),
  type: z.string(),
  image: z.string().optional(),
  nameCn: z.string().optional(),
  summary: z.string().optional(),
  career: z.array(z.string()).optional(),
  infobox: z.record(z.string(), z.string()).optional()
});
export type BangumiPersonBrief = z.infer<typeof BangumiPersonBriefSchema>;

export const BangumiPersonDetailSchema = BangumiPersonBriefSchema.extend({
  birthday: z.string().optional(),
  bloodType: z.string().optional(),
  roles: BangumiRelatedListSchema.optional(),
  works: BangumiRelatedListSchema.optional(),
  stat: z.record(z.string(), z.number()).optional()
});
export type BangumiPersonDetail = z.infer<typeof BangumiPersonDetailSchema>;

export const BangumiSearchItemSchema = z.union([
  BangumiPersonBriefSchema,
  BangumiSubjectBriefSchema,
  BangumiCharacterBriefSchema
]);
export type BangumiSearchItem = z.infer<typeof BangumiSearchItemSchema>;

export const BangumiSearchResultSchema = z.object({
  query: z.string(),
  total: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
  returned: z.number(),
  totalCapped: z.boolean().optional(),
  kind: BangumiSearchKindSchema,
  items: z.array(BangumiSearchItemSchema)
});
export type BangumiSearchResult = z.infer<typeof BangumiSearchResultSchema>;

// ---------- 调用参数与错误 ----------

/** 搜索调用的可选参数，由工具输入映射而来 */
export interface BangumiSearchOptions {
  limit?: number;
  offset?: number;
  career?: string[];
  sort?: BangumiSort;
  kinds?: BangumiSubjectKind[];
}

/** 投影时的字段预算，取值来自 constants/bangumi */
export interface BangumiTextLimits {
  tags: number;
  summary: number;
  infoboxKeys: number;
  infoboxValue: number;
}

export class BangumiError extends Error {
  constructor(
    readonly code:
      | "aborted"
      | "network"
      | "service"
      | "timeout"
      | "not_found"
      | "unreachable"
      | "rate_limited"
      | "invalid_input",
    message: string
  ) {
    super(message);
    this.name = "BangumiError";
  }
}
