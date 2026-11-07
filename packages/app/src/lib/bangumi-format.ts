import { take, uniq, sortBy, uniqBy, isEmpty, truncate } from "lodash-es";
import { MainBangumiConstants } from "@/constants/bangumi";
import {
  type BangumiImage,
  type BangumiPerson,
  BangumiPersonSchema,
  type BangumiSubject,
  BangumiSubjectSchema,
  type BangumiCharacter,
  BangumiCharacterSchema,
  type BangumiRelatedRow,
  type BangumiTextLimits,
  type BangumiInfoboxItem,
  type BangumiPersonBrief,
  type BangumiRelatedItem,
  type BangumiRelatedList,
  type BangumiPersonDetail,
  BangumiRelatedRowsSchema,
  type BangumiSubjectBrief,
  type BangumiSubjectDetail,
  type BangumiCharacterBrief,
  type BangumiCharacterDetail
} from "@/types/bangumi";

/**
 * 投影层：把 types/bangumi 里建模好的原始数据压成工具输出的形状。
 * 原始响应单条可达数 KB 到上百 KB，直接透出会撑爆输出上限，所以这里只挑字段并截断长文本。
 */

const siteUrl = (path: string, id: number) => `${MainBangumiConstants.SITE_ORIGIN}/${path}/${id}`;

const typeLabel = (labels: Record<number, string>, type: number | undefined) =>
  (type === undefined ? undefined : labels[type]) ?? "未知";

/** 摘要里的换行与缩进对模型没有价值，压成单行后按字符数截断（省略号计入长度）。 */
function clampText(value: Undefinable<string>, limit: number): Undefinable<string> {
  const collapsed = value?.replace(/\s+/g, " ");
  if (!collapsed || limit <= 0) return undefined;
  return truncate(collapsed, { length: limit, omission: "…" });
}

function pickImage(images: BangumiImage): Undefinable<string> {
  return images?.large ?? images?.medium ?? images?.common ?? images?.small ?? images?.grid;
}

/** 去重、去空、截断：空串同样视为无值（schema 允许空字符串，但输出里没有意义）。 */
function pickStrings(values: readonly string[], limit: number): string[] | undefined {
  const names = take(uniq(values.filter(Boolean)), limit);
  return isEmpty(names) ? undefined : names;
}

function pickTags(tags: ReadonlyArray<{ name: string }>, limit: number): string[] | undefined {
  return pickStrings(
    tags.map((tag) => tag.name),
    limit
  );
}

/** 计数类字段允许缺失，落库前统一剔除 undefined。 */
function pickNumbers(
  entries: Record<string, number | undefined>
): undefined | Record<string, number> {
  const defined = Object.entries(entries).filter(
    (entry): entry is [string, number] => entry[1] !== undefined
  );
  return defined.length ? Object.fromEntries(defined) : undefined;
}

function infoboxValueText(value: Undefinable<string> | Array<{ k?: string; v?: string }>): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value
    .map((part) => (part.k ? `${part.k}: ${part.v ?? ""}` : (part.v ?? "")))
    .filter(Boolean)
    .join("；");
}

/** 角色与人物没有 name_cn 字段，中文名只存在于 infobox 的「简体中文名」里。 */
function pickChineseName(items: ReadonlyArray<BangumiInfoboxItem>): Undefinable<string> {
  for (const key of ["简体中文名", "中文名", "第二中文名"]) {
    const item = items.find((entry) => entry.key === key);
    const name =
      item && clampText(infoboxValueText(item.value), MainBangumiConstants.CHINESE_NAME_MAX);
    if (name) return name;
  }
  return undefined;
}

function priorityOf(key: string): number {
  const priorities = MainBangumiConstants.InfoboxPriorities;
  const index = priorities.indexOf(key);
  return index < 0 ? priorities.length : index;
}

function pickInfobox(
  items: ReadonlyArray<BangumiInfoboxItem>,
  keys: number,
  valueLimit: number
): undefined | Record<string, string> {
  if (keys <= 0 || valueLimit <= 0) return undefined;
  const entries = items.flatMap((item) => {
    const value = clampText(infoboxValueText(item.value), valueLimit);
    return value ? [[item.key, value] as const] : [];
  });
  if (isEmpty(entries)) return undefined;
  // sortBy 是稳定排序：优先字段先出，其余保持接口返回顺序，再取预算内的条目。
  return Object.fromEntries(
    take(
      sortBy(entries, ([key]) => priorityOf(key)),
      keys
    )
  );
}

function formatBirthday(input: {
  birth_day?: number;
  birth_mon?: number;
  birth_year?: number;
}): Undefinable<string> {
  const year = input.birth_year;
  const month = input.birth_mon;
  const day = input.birth_day;
  if (!month || !day) return undefined;
  const pad = (value: number) => String(value).padStart(2, "0");
  return year ? `${year}-${pad(month)}-${pad(day)}` : `${pad(month)}-${pad(day)}`;
}

function dedupeById<T extends { id: number }>(entries: T[]): T[] {
  return uniqBy(entries, "id");
}

const relatedItem = (
  row: BangumiRelatedRow,
  path: string,
  relation: Undefinable<string>
): undefined | BangumiRelatedItem => {
  if (!row.id || !row.name) return undefined;
  return {
    id: row.id,
    url: siteUrl(path, row.id),
    name: row.name,
    nameCn: row.name_cn,
    relation
  };
};

function relatedList(
  raw: unknown,
  limit: number,
  build: (row: BangumiRelatedRow) => undefined | BangumiRelatedItem,
  options: { dedupe?: boolean } = {}
): BangumiRelatedList {
  const rows = BangumiRelatedRowsSchema.parse(raw);
  const entries = rows.flatMap((row) => {
    const item = build(row);
    return item ? [item] : [];
  });
  const unique = options.dedupe === false ? entries : dedupeById(entries);
  const items = take(unique, limit);
  return { total: unique.length, omitted: unique.length - items.length, items };
}

// ---------- 对外投影 ----------

function subjectBrief(
  subject: BangumiSubject,
  limits: BangumiTextLimits
): undefined | BangumiSubjectBrief {
  if (!subject.id || !subject.name) return undefined;
  return {
    id: subject.id,
    url: siteUrl("subject", subject.id),
    type: typeLabel(MainBangumiConstants.SubjectTypeLabels, subject.type),
    name: subject.name,
    nameCn: subject.name_cn,
    date: subject.date,
    platform: subject.platform,
    score: subject.rating?.score,
    rank: subject.rating?.rank || undefined,
    ratingCount: subject.rating?.total || undefined,
    tags: pickTags(subject.tags, limits.tags),
    image: pickImage(subject.images) ?? subject.image,
    summary: clampText(subject.summary, limits.summary),
    infobox: pickInfobox(subject.infobox, limits.infoboxKeys, limits.infoboxValue)
  };
}

function characterBrief(
  character: BangumiCharacter,
  limits: BangumiTextLimits
): undefined | BangumiCharacterBrief {
  if (!character.id || !character.name) return undefined;
  return {
    id: character.id,
    url: siteUrl("character", character.id),
    type: typeLabel(MainBangumiConstants.CharacterTypeLabels, character.type),
    name: character.name,
    nameCn: pickChineseName(character.infobox),
    image: pickImage(character.images),
    summary: clampText(character.summary, limits.summary),
    infobox: pickInfobox(character.infobox, limits.infoboxKeys, limits.infoboxValue)
  };
}

function personBrief(
  person: BangumiPerson,
  limits: BangumiTextLimits
): undefined | BangumiPersonBrief {
  if (!person.id || !person.name) return undefined;
  const career = person.career.map((item) => MainBangumiConstants.CareerLabels[item] ?? item);
  return {
    id: person.id,
    url: siteUrl("person", person.id),
    type: typeLabel(MainBangumiConstants.PersonTypeLabels, person.type),
    name: person.name,
    nameCn: pickChineseName(person.infobox),
    career: pickStrings(career, career.length),
    image: pickImage(person.images),
    summary: clampText(person.summary, limits.summary),
    infobox: pickInfobox(person.infobox, limits.infoboxKeys, limits.infoboxValue)
  };
}

export function formatSubjectBrief(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiSubjectBrief {
  const parsed = BangumiSubjectSchema.safeParse(raw);
  return parsed.success ? subjectBrief(parsed.data, limits) : undefined;
}

export function formatSubjectDetail(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiSubjectDetail {
  const parsed = BangumiSubjectSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const subject = parsed.data;
  const brief = subjectBrief(subject, limits);
  if (!brief) return undefined;
  return {
    ...brief,
    eps: subject.eps || undefined,
    totalEpisodes: subject.total_episodes || undefined,
    volumes: subject.volumes || undefined,
    series: subject.series === true ? true : undefined,
    metaTags: pickStrings(subject.meta_tags, MainBangumiConstants.META_TAG_LIMIT),
    ratingDistribution: subject.rating?.count,
    collection: subject.collection
      ? pickNumbers({
          collect: subject.collection.collect,
          doing: subject.collection.doing,
          dropped: subject.collection.dropped,
          onHold: subject.collection.on_hold,
          wish: subject.collection.wish
        })
      : undefined
  };
}

export function formatCharacterBrief(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiCharacterBrief {
  const parsed = BangumiCharacterSchema.safeParse(raw);
  return parsed.success ? characterBrief(parsed.data, limits) : undefined;
}

export function formatCharacterDetail(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiCharacterDetail {
  const parsed = BangumiCharacterSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const character = parsed.data;
  const brief = characterBrief(character, limits);
  if (!brief) return undefined;
  return {
    ...brief,
    birthday: formatBirthday(character),
    bloodType: character.blood_type,
    // 性别只从 infobox 的「性别」读取：工具层脱敏名单会删掉顶层 gender 字段。
    stat: character.stat
      ? pickNumbers({ comments: character.stat.comments, collects: character.stat.collects })
      : undefined
  };
}

export function formatPersonBrief(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiPersonBrief {
  const parsed = BangumiPersonSchema.safeParse(raw);
  return parsed.success ? personBrief(parsed.data, limits) : undefined;
}

export function formatPersonDetail(
  raw: unknown,
  limits: BangumiTextLimits
): undefined | BangumiPersonDetail {
  const parsed = BangumiPersonSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const person = parsed.data;
  const brief = personBrief(person, limits);
  if (!brief) return undefined;
  return {
    ...brief,
    birthday: formatBirthday(person),
    bloodType: person.blood_type,
    stat: person.stat
      ? pickNumbers({ comments: person.stat.comments, collects: person.stat.collects })
      : undefined
  };
}

/** 条目下的角色：带出演关系与声优，数量可能上百，必须截断。 */
export function formatSubjectCharacters(raw: unknown, limit: number): BangumiRelatedList {
  return relatedList(
    raw,
    limit,
    (row) => {
      const item = relatedItem(row, "character", row.relation);
      if (!item) return undefined;
      const actors = row.actors
        .map((actor) => (typeof actor === "string" ? actor : actor.name))
        .filter(Boolean)
        .slice(0, MainBangumiConstants.ACTOR_LIMIT);
      return actors.length ? { ...item, actors } : item;
    },
    { dedupe: false }
  );
}

export function formatSubjectPersons(raw: unknown, limit: number): BangumiRelatedList {
  return relatedList(raw, limit, (row) => relatedItem(row, "person", row.relation), {
    dedupe: false
  });
}

/**
 * 角色/人物参与的作品。接口按「作品 × 关系」逐行返回，同一作品可能重复出现。
 */
export function formatWorks(raw: unknown, limit: number): BangumiRelatedList {
  return relatedList(raw, limit, (row) => {
    const item = relatedItem(row, "subject", row.staff);
    return item
      ? { ...item, type: typeLabel(MainBangumiConstants.SubjectTypeLabels, row.type) }
      : undefined;
  });
}

/** 角色的声优：接口按「声优 × 作品」逐行返回，需要按人物去重。 */
export function formatCharacterActors(raw: unknown, limit: number): BangumiRelatedList {
  return relatedList(raw, limit, (row) => relatedItem(row, "person", row.staff));
}

/** 人物配音的角色：同样按「角色 × 作品」逐行返回，需要按角色去重。 */
export function formatPersonRoles(raw: unknown, limit: number): BangumiRelatedList {
  return relatedList(raw, limit, (row) => relatedItem(row, "character", row.staff));
}
