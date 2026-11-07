import { BangumiAPI } from "@mahiru/app/lib/bangumi";
import { createAgentToolCatalog } from "@mahiru/app/inner/agent/tools";
import { AgentToolBangumi } from "@mahiru/app/inner/agent/tools/inner";
import { formatSubjectBrief, formatSubjectPersons } from "@mahiru/app/lib/bangumi-format";
import {
  BangumiPersonDetailSchema,
  BangumiSearchResultSchema,
  BangumiSubjectDetailSchema,
  BangumiCharacterDetailSchema
} from "@mahiru/app/types/bangumi";

const electronMock = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>() }));

vi.mock("electron", () => ({
  app: { getVersion: () => "1.3.5" },
  net: { fetch: electronMock.fetch },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

vi.mock("@mahiru/app/lib/web-search", () => ({ WebBrowser: {} }));

const context = { conversationID: "test", outputDetail: "standard" } as const;

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

/** Body 只能读一次，多次请求必须每次新建 Response。 */
const stubJson = (body: unknown, status = 200) =>
  electronMock.fetch.mockImplementation(async () => respond(body, status));

const subjectRow = (overrides: Record<string, unknown> = {}) => ({
  id: 253,
  type: 2,
  name: "カウボーイビバップ",
  name_cn: "星际牛仔",
  date: "1998-10-23",
  platform: "TV",
  summary: "赏金猎人的故事。".repeat(300),
  images: { large: "https://lain.bgm.tv/pic/cover/l/x.jpg" },
  tags: [
    { name: "科幻" },
    { name: "经典" },
    { name: "渡边信一郎" },
    { name: "爵士" },
    { name: "神作" }
  ],
  rating: { rank: 4, total: 19804, score: 9.1 },
  infobox: [
    { key: "导演", value: "渡边信一郎" },
    { key: "话数", value: "26" },
    { key: "中文名", value: "星际牛仔" },
    { key: "别名", value: [{ k: "英文名", v: "Cowboy Bebop" }] }
  ],
  collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
  ...overrides
});

const characterRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: 1,
  name: "ルルーシュ・ランペルージ",
  gender: "male",
  birth_mon: 12,
  birth_day: 5,
  birth_year: 2000,
  blood_type: "A",
  summary: "主角。",
  images: { large: "https://lain.bgm.tv/pic/crt/l/x.jpg" },
  infobox: [
    { key: "简体中文名", value: "鲁路修·兰佩路基" },
    { key: "性别", value: "男" },
    { key: "引用来源", value: "Wikipedia" }
  ],
  stat: { comments: 192, collects: 1270 },
  ...overrides
});

beforeEach(() => {
  BangumiAPI.resetTransport();
  electronMock.fetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Bangumi 工具声明", () => {
  it("只接受有界的搜索与详情参数", () => {
    const schema = AgentToolBangumi.inputSchema;

    expect(schema.safeParse({ action: "search", query: "星际牛仔" }).success).toBe(true);
    expect(
      schema.safeParse({ action: "search", query: "东方", limit: 20, offset: 999 }).success
    ).toBe(true);
    expect(schema.safeParse({ action: "search", query: "东方", limit: 21 }).success).toBe(false);
    expect(schema.safeParse({ action: "search", query: "东方", limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ action: "search", query: "东方", offset: 1000 }).success).toBe(false);
    expect(schema.safeParse({ action: "search", query: "东方", kind: "music" }).success).toBe(
      false
    );
    expect(
      schema.safeParse({ action: "subject", include: ["characters", "staff", "works"] }).success
    ).toBe(false);
    expect(schema.safeParse({ action: "subject", types: ["music", "anime"] }).success).toBe(true);
  });

  it("搜索默认按条目检索，且 detail 由框架注入", () => {
    const schema = AgentToolBangumi.inputSchema;
    const parsed = schema.safeParse({ action: "search", query: "星际牛仔" });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.kind).toBe("subject");
    expect(schema.safeParse({ action: "subject", id: 1, detail: "detailed" }).success).toBe(true);
    expect(schema.safeParse({ action: "subject", id: 1, detail: "verbose" }).success).toBe(false);
    expect(AgentToolBangumi.timeoutMs).toBe(25_000);
  });

  it("作为只读开放式 inner 工具进入工具目录并允许并行", () => {
    const catalog = createAgentToolCatalog(true);
    const tool = catalog.list.find((item) => item.name === "agent-tool-bangumi");

    expect(tool?.risk).toBe("read");
    expect(tool?.execution).toBe("main");
    expect(tool?.openWorld).toBe(true);
    expect(catalog.parallelSafeNames).toContain("agent-tool-bangumi");
  });
});

describe("Bangumi 搜索请求", () => {
  it("仅传入指定的作品类型，并把分页压到接口上限", async () => {
    electronMock.fetch.mockResolvedValue(respond({ data: [subjectRow()], total: 366 }));

    await BangumiAPI.search(
      "subject",
      "星际牛仔",
      { limit: 99, offset: 5_000, kinds: ["music"] },
      "standard"
    );

    const [url, init] = electronMock.fetch.mock.calls[0]!;
    expect(String(url)).toContain("limit=20");
    expect(String(url)).toContain("offset=999");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      keyword: "星际牛仔",
      filter: { type: [3] }
    });
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^AiraMusic\/1\.3\.5 /);
  });

  it("角色和未指定类型的作品不添加过滤，人物仅在指定职业时带过滤", async () => {
    stubJson({ data: [], total: 0 });

    await BangumiAPI.search("character", "斯派克", {}, "compact");
    expect(JSON.parse(String(electronMock.fetch.mock.calls[0]![1]?.body))).toEqual({
      keyword: "斯派克"
    });

    await BangumiAPI.search("person", "花泽香菜", { career: ["seiyu"] }, "compact");
    expect(JSON.parse(String(electronMock.fetch.mock.calls[1]![1]?.body))).toEqual({
      keyword: "花泽香菜",
      filter: { career: ["seiyu"] }
    });

    await BangumiAPI.search("person", "久石让", {}, "compact");
    expect(JSON.parse(String(electronMock.fetch.mock.calls[2]![1]?.body))).toEqual({
      keyword: "久石让"
    });

    await BangumiAPI.search("subject", "星际牛仔", {}, "compact");
    expect(JSON.parse(String(electronMock.fetch.mock.calls[3]![1]?.body))).toEqual({
      keyword: "星际牛仔"
    });
  });

  it("按 detail 收紧摘要、标签与 infobox 预算", async () => {
    stubJson({ data: [subjectRow()], total: 1 });

    const compact = await BangumiAPI.search("subject", "compact-预算", {}, "compact");
    const standard = await BangumiAPI.search("subject", "standard-预算", {}, "standard");
    const detailed = await BangumiAPI.search("subject", "detailed-预算", {}, "detailed");

    expect(compact.items[0]).toMatchObject({ id: 253, type: "动画", nameCn: "星际牛仔" });
    // 紧凑档不产生摘要与 infobox 内容（字段值为 undefined，序列化时自然消失）。
    expect((compact.items[0] as { summary?: string }).summary).toBeUndefined();
    expect((compact.items[0] as { infobox?: unknown }).infobox).toBeUndefined();
    expect((compact.items[0] as { tags: string[] }).tags).toHaveLength(3);

    const standardItem = standard.items[0] as { tags: string[]; summary: string };
    expect(standardItem.summary.length).toBeLessThanOrEqual(181);
    expect(standardItem.tags).toHaveLength(5);
    expect((standard.items[0] as { infobox?: unknown }).infobox).toBeUndefined();

    const detailedItem = detailed.items[0] as unknown as Record<string, unknown>;
    expect(Object.keys(detailedItem["infobox"] as object)[0]).toBe("中文名");
    expect(detailedItem["infobox"]).toMatchObject({ 别名: "英文名: Cowboy Bebop" });
  });

  it("单次结果不会撑爆工具输出预算", async () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      subjectRow({ id: 9000 + index, summary: "很长的简介。".repeat(600) })
    );
    electronMock.fetch.mockResolvedValue(respond({ data: rows, total: 2_000 }));

    const result = await BangumiAPI.search("subject", "超大结果", { limit: 20 }, "detailed");

    expect(result.items).toHaveLength(10);
    expect(result.totalCapped).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThan(18_000);
  });

  it("总量封顶时标记 totalCapped 并给出续页信息", async () => {
    electronMock.fetch.mockResolvedValue(
      respond({ data: [subjectRow(), subjectRow({ id: 254 })], total: 1000 })
    );

    const result = await BangumiAPI.search("subject", "东方", { limit: 2, offset: 20 }, "compact");

    expect(result.total).toBe(1_000);
    expect(result.returned).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.totalCapped).toBe(true);
  });

  it("详细模式能取到 offset=990 的最后十条，并正确结束翻页", async () => {
    stubJson({
      data: Array.from({ length: 10 }, (_, index) => subjectRow({ id: 990 + index })),
      total: 1000
    });

    const result = await BangumiAPI.search(
      "subject",
      "详细模式最后一页",
      { limit: 20, offset: 990 },
      "detailed"
    );

    expect(
      AgentToolBangumi.inputSchema.safeParse({
        action: "search",
        query: "详细模式最后一页",
        offset: 990
      }).success
    ).toBe(true);
    const url = new URL(String(electronMock.fetch.mock.calls[0]![0]));
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("990");
    expect(result).toMatchObject({ offset: 990, returned: 10, total: 1000, hasMore: false });
    expect(result.items.map((item) => item.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => 990 + index)
    );
  });

  it("空关键词不发起请求", async () => {
    await expect(BangumiAPI.search("subject", "   ", {}, "standard")).rejects.toMatchObject({
      code: "invalid_input"
    });
    expect(electronMock.fetch).not.toHaveBeenCalled();

    await expect(
      AgentToolBangumi.execute({ action: "search", query: "  ", kind: "subject" }, context)
    ).rejects.toMatchObject({ code: "invalid_tool_call" });
  });
});

describe("Bangumi 详情投影", () => {
  it("条目详情保留评分、收藏与优先级最高的 infobox 字段", async () => {
    electronMock.fetch.mockResolvedValue(respond(subjectRow({ id: 3001 })));

    const detail = await BangumiAPI.subject(3001, "standard", []);

    expect(detail).toMatchObject({
      id: 3001,
      url: "https://bgm.tv/subject/3001",
      type: "动画",
      score: 9.1,
      rank: 4,
      ratingCount: 19_804,
      collection: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 }
    });
    expect(Object.keys(detail.infobox!)[0]).toBe("中文名");
    expect(detail.summary!.length).toBeLessThanOrEqual(801);
  });

  it("条目详情可追加角色与制作人员，并标注省略数量", async () => {
    const characters = Array.from({ length: 40 }, (_, index) => ({
      id: 77 + index,
      name: `角色${index}`,
      relation: "主角",
      actors: [{ name: "山寺宏一" }, { name: "Steven Blum" }]
    }));
    const staff = Array.from({ length: 130 }, (_, index) => ({
      id: 1_400 + index,
      name: `制作${index}`,
      relation: "音乐监督"
    }));
    electronMock.fetch
      .mockResolvedValueOnce(respond(subjectRow({ id: 3002 })))
      .mockResolvedValueOnce(respond(characters))
      .mockResolvedValueOnce(respond(staff));

    const detail = await BangumiAPI.subject(3002, "detailed", ["characters", "staff"]);

    expect(detail.characters).toMatchObject({ total: 40, omitted: 16 });
    expect(detail.characters!.items[0]).toMatchObject({
      relation: "主角",
      actors: ["山寺宏一", "Steven Blum"]
    });
    expect(detail.staff).toMatchObject({ total: 130, omitted: 106 });
    expect(electronMock.fetch).toHaveBeenCalledTimes(3);
  });

  it("角色详情从中文字段取名，不依赖会被脱敏的顶层 gender", async () => {
    electronMock.fetch.mockResolvedValue(respond(characterRow()));

    const detail = await BangumiAPI.character(1, "standard", []);

    expect(detail).toMatchObject({
      nameCn: "鲁路修·兰佩路基",
      birthday: "2000-12-05",
      bloodType: "A",
      stat: { comments: 192, collects: 1_270 }
    });
    expect(detail).not.toHaveProperty("gender");
    expect(detail.infobox).toMatchObject({ 性别: "男" });
  });

  it("人物作品按 id 去重，重复行只保留一条", async () => {
    const rows = [
      { id: 12105, name: "OVA 主题曲", staff: "艺术家", type: 3 },
      { id: 12105, name: "OVA 主题曲", staff: "作曲", type: 3 },
      { id: 11011, name: "MAGIC ATTRACTION", staff: "艺术家", type: 3 }
    ];
    electronMock.fetch.mockResolvedValueOnce(respond(characterRow({ id: 2 })));
    electronMock.fetch.mockResolvedValueOnce(respond(rows));

    const detail = await BangumiAPI.character(2, "standard", ["works"]);

    expect(detail.works).toMatchObject({ total: 2, omitted: 0 });
    expect(detail.works!.items).toHaveLength(2);
    expect(detail.works!.items[0]).toMatchObject({ id: 12105, relation: "艺术家", type: "音乐" });
  });

  it("声优列表按人物去重，避免同一人按作品重复出现", async () => {
    const rows = [
      { id: 3818, name: "福山潤", staff: "主角" },
      { id: 3818, name: "福山潤", staff: "主角" },
      { id: 9001, name: "小清水亜美", staff: "主角" }
    ];
    electronMock.fetch.mockResolvedValueOnce(respond(characterRow({ id: 3 })));
    electronMock.fetch.mockResolvedValueOnce(respond(rows));

    const detail = await BangumiAPI.character(3, "standard", ["actors"]);

    expect(detail.actors).toMatchObject({ total: 2, omitted: 0 });
    expect(detail.actors!.items.map((item) => item["name"])).toEqual(["福山潤", "小清水亜美"]);
  });
});

describe("Bangumi 错误映射与缓存", () => {
  it("把 404 映射成 not_found，把 5xx 映射成可读的 service 错误", async () => {
    electronMock.fetch.mockResolvedValueOnce(respond({ title: "Not Found" }, 404));
    await expect(BangumiAPI.subject(9_999_999, "standard", [])).rejects.toMatchObject({
      code: "not_found"
    });

    electronMock.fetch.mockResolvedValueOnce(
      respond({ description: "resource can't be found" }, 500)
    );
    await expect(BangumiAPI.subject(9_999_998, "standard", [])).rejects.toMatchObject({
      code: "service",
      message: expect.stringContaining("resource can't be found")
    });
  });

  it("把 Chromium 的连接错误翻译成可读的不可达原因", async () => {
    electronMock.fetch.mockRejectedValueOnce(new Error("net::ERR_NAME_NOT_RESOLVED"));

    await expect(BangumiAPI.subject(9_999_997, "standard", [])).rejects.toMatchObject({
      code: "unreachable",
      message: expect.stringContaining("DNS 解析失败")
    });
  });

  it("网络失败后短时间内直接失败，不再等超时，并提示改用网页搜索", async () => {
    electronMock.fetch.mockRejectedValueOnce(new Error("net::ERR_TUNNEL_CONNECTION_FAILED"));

    await expect(BangumiAPI.subject(8_001, "standard", [])).rejects.toMatchObject({
      code: "unreachable",
      message: expect.stringContaining("系统代理不可用")
    });
    await expect(BangumiAPI.subject(8_002, "standard", [])).rejects.toMatchObject({
      code: "unreachable",
      message: expect.stringContaining("agent-tool-web-snapshot")
    });
    // 熔断期间不产生新请求，Agent 可以立刻改走网页搜索。
    expect(electronMock.fetch).toHaveBeenCalledTimes(1);
  });

  it("外部取消返回 aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      BangumiAPI.search("subject", "取消", {}, "standard", controller.signal)
    ).rejects.toMatchObject({ code: "aborted" });
    expect(electronMock.fetch).not.toHaveBeenCalled();
  });

  it("相同请求命中本地缓存，不重复打接口", async () => {
    stubJson({ data: [subjectRow()], total: 1 });

    const first = await BangumiAPI.search("subject", "缓存命中", {}, "compact");
    const second = await BangumiAPI.search("subject", "缓存命中", {}, "compact");

    expect(electronMock.fetch).toHaveBeenCalledTimes(1);
    expect(first.total).toBe(1);
    expect(second).toEqual(first);
  });
});

describe("Bangumi 响应容错", () => {
  it("单字段类型漂移只丢该字段，不影响同一条目", async () => {
    stubJson({
      data: [subjectRow({ date: 19_981_023, summary: null, rating: { score: "9.1", total: 10 } })],
      total: 1
    });

    const result = await BangumiAPI.search("subject", "字段漂移", {}, "standard");
    const item = result.items[0] as unknown as Record<string, unknown>;

    expect(item).toMatchObject({ id: 253, name: "カウボーイビバップ", nameCn: "星际牛仔" });
    expect(item["date"]).toBeUndefined();
    expect(item["summary"]).toBeUndefined();
    expect(item["score"]).toBeUndefined();
    expect(item["ratingCount"]).toBe(10);
  });

  it("丢弃不合格的条目，保留同页其余数据", async () => {
    stubJson({ data: [subjectRow(), "not-a-subject", { id: 5 }], total: 3 });

    const result = await BangumiAPI.search("subject", "脏数据", {}, "compact");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 253 });
    // 服务端给出的总数照实回报，不因为本地丢弃而改写。
    expect(result.total).toBe(3);
  });

  it("搜索信封不是对象时退化成空结果而不是抛错", async () => {
    electronMock.fetch.mockResolvedValueOnce(respond(null));

    const result = await BangumiAPI.search("subject", "坏信封", {}, "compact");

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("infobox 的字符串与对象数组两种 value 都能展开", () => {
    const brief = formatSubjectBrief(
      subjectRow({
        infobox: [
          { key: "中文名", value: "星际牛仔" },
          { key: "别名", value: [{ k: "英文名", v: "Cowboy Bebop" }, { v: "星际" }] },
          { key: "空值" },
          { key: 123, value: "键名不是字符串" }
        ]
      }),
      { tags: 5, summary: 100, infoboxKeys: 5, infoboxValue: 100 }
    );

    expect(brief?.infobox).toEqual({ 中文名: "星际牛仔", 别名: "英文名: Cowboy Bebop；星际" });
  });

  it("关联行缺 id 或 name 时跳过，并如实统计总数", () => {
    const list = formatSubjectPersons(
      [{ id: 1, name: "水樹奈々" }, { name: "没有 id" }, { id: 2 }, { id: 3, name: "花澤香菜" }],
      10
    );

    expect(list.items.map((item) => item.name)).toEqual(["水樹奈々", "花澤香菜"]);
    expect(list.total).toBe(2);
    expect(list.omitted).toBe(0);
  });
});

describe("Bangumi 输出契约", () => {
  it("搜索与详情结果都满足 types/bangumi 声明的输出 schema", async () => {
    stubJson({ data: [subjectRow()], total: 1 });
    const search = await BangumiAPI.search("subject", "契约校验", {}, "detailed");
    expect(BangumiSearchResultSchema.safeParse(search).success).toBe(true);

    electronMock.fetch.mockReset();
    electronMock.fetch.mockResolvedValueOnce(respond(subjectRow({ id: 3_100 })));
    electronMock.fetch.mockResolvedValueOnce(
      respond([{ id: 77, name: "スパイク", relation: "主角", actors: [{ name: "山寺宏一" }] }])
    );
    const subject = await BangumiAPI.subject(3_100, "detailed", ["characters"]);
    expect(BangumiSubjectDetailSchema.safeParse(subject).success).toBe(true);

    electronMock.fetch.mockReset();
    electronMock.fetch.mockResolvedValueOnce(respond(characterRow({ id: 3_200 })));
    const character = await BangumiAPI.character(3_200, "standard", []);
    expect(BangumiCharacterDetailSchema.safeParse(character).success).toBe(true);

    electronMock.fetch.mockReset();
    electronMock.fetch.mockResolvedValueOnce(
      respond({ id: 3_300, name: "水樹奈々", career: ["seiyu"], birth_mon: 1, birth_day: 21 })
    );
    const person = await BangumiAPI.person(3_300, "standard", []);
    expect(BangumiPersonDetailSchema.safeParse(person).success).toBe(true);
  });
});
