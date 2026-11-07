import type { BangumiSearchKind, BangumiSubjectKind } from "@/types/bangumi";

/**
 * Bangumi（bgm.tv）公开 API 的调用上限
 * 数值均按实测行为确定
 * */
export class MainBangumiConstants {
  static readonly API_ORIGIN = "https://api.bgm.tv";
  static readonly SITE_ORIGIN = "https://bgm.tv";
  /** Bangumi 要求带可识别 User-Agent：https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md */
  static readonly USER_AGENT_CONTACT = "+https://github.com/mahiru/AiraMusic";
  static readonly REQUEST_TIMEOUT_MS = 6_000;
  /** 网络类失败后的熔断窗口：期间直接报错，避免 Agent 反复等超时再去换工具。 */
  static readonly UNREACHABLE_COOLDOWN_MS = 30_000;

  /** 搜索接口 limit 硬上限为 20，传更大值仍只返回 20 条（实测）。 */
  static readonly SEARCH_PAGE_MAX = 20;
  /** 搜索结果 total 封顶 1000（meilisearch），offset 超过即无意义。 */
  static readonly SEARCH_TOTAL_MAX = 1_000;
  static readonly SEARCH_OFFSET_MAX = MainBangumiConstants.SEARCH_TOTAL_MAX - 1;
  /** 搜索关键词的最大长度：够放长标题，又不至于把整段文本塞进 keyword */
  static readonly SEARCH_KEYWORD_MAX = 120;
  /** 详情一次最多追加的关联数据种类（subject 的 characters + staff 已是两项） */
  static readonly INCLUDE_MAX = 2;

  static readonly CACHE_TTL_MS = 5 * 60_000;
  static readonly CACHE_ENTRY_LIMIT = 64;
  static readonly CACHE_ENTRY_MAX_CHARS = 200_000;

  /** 搜索列表的字段预算；单次工具输出需控制在 18,000 字符以内。 */
  static readonly SEARCH_LIMITS = {
    compact: { items: 20, summary: 0, tags: 3, infoboxKeys: 0, infoboxValue: 0 },
    standard: { items: 20, summary: 180, tags: 5, infoboxKeys: 0, infoboxValue: 0 },
    detailed: { items: 10, summary: 320, tags: 8, infoboxKeys: 6, infoboxValue: 100 }
  } as const;

  /** 详情页的字段预算；infobox 条目数 × 单值长度决定体积上限。 */
  static readonly DETAIL_LIMITS = {
    compact: { summary: 240, tags: 6, infoboxKeys: 10, infoboxValue: 80, related: 6 },
    standard: { summary: 800, tags: 10, infoboxKeys: 18, infoboxValue: 120, related: 12 },
    detailed: { summary: 1_600, tags: 16, infoboxKeys: 40, infoboxValue: 180, related: 24 }
  } as const;

  /** 关联列表上限：条目下角色/ staff 单次可能上百条，必须截断。 */
  static readonly RELATED_LIMIT = {
    characters: 24,
    staff: 30,
    works: 20,
    actors: 16,
    roles: 20
  } as const;

  /** 条目详情的 meta_tags 保留条数 */
  static readonly META_TAG_LIMIT = 8;
  /** 角色/人物的中文名截断长度 */
  static readonly CHINESE_NAME_MAX = 60;
  /** 条目下每个角色最多保留的声优数 */
  static readonly ACTOR_LIMIT = 4;

  static readonly SubjectKindTypes = {
    book: 1,
    anime: 2,
    music: 3,
    game: 4,
    real: 6
  } as const satisfies Record<BangumiSubjectKind, number>;

  /** 接口用数字表示条目类型，展示时换成中文；没有 5 */
  static readonly SubjectTypeLabels: Record<number, string> = {
    1: "书籍",
    2: "动画",
    3: "音乐",
    4: "游戏",
    6: "三次元"
  };

  /** 角色类型：角色 / 机体 / 舰船 / 组织 */
  static readonly CharacterTypeLabels: Record<number, string> = {
    1: "角色",
    2: "机体",
    3: "舰船",
    4: "组织"
  };

  /** 人物类型：个人 / 公司 / 组合 */
  static readonly PersonTypeLabels: Record<number, string> = {
    1: "个人",
    2: "公司",
    3: "组合"
  };

  /** 接口的 PersonCareer 取值，展示时换成中文 */
  static readonly CareerLabels: Record<string, string> = {
    actor: "演员",
    artist: "艺术家",
    illustrator: "插画师",
    mangaka: "漫画家",
    producer: "制作人",
    seiyu: "声优",
    writer: "作家"
  };

  /** infobox 的原顺序按编辑习惯排列，条目信息量最大的字段经常排在后面，取值时先看这张表 */
  static readonly InfoboxPriorities: readonly string[] = [
    "简体中文名",
    "中文名",
    "别名",
    "艺术家",
    "作曲",
    "编曲",
    "厂牌",
    "发售日期",
    "播放时长",
    "性别",
    "生日",
    "血型",
    "身高",
    "体重",
    "话数",
    "集数",
    "导演",
    "原作",
    "动画制作",
    "制作公司",
    "引用来源"
  ];

  static readonly SearchPaths = {
    character: "/v0/search/characters",
    person: "/v0/search/persons",
    subject: "/v0/search/subjects"
  } as const satisfies Record<BangumiSearchKind, string>;

  static readonly DetailPaths = {
    character: "/v0/characters",
    person: "/v0/persons",
    subject: "/v0/subjects"
  } as const satisfies Record<BangumiSearchKind, string>;
}
