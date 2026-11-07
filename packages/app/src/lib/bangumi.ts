import { z } from "zod";
import { clamp } from "lodash-es";
import { app, net } from "electron";
import { MainBangumiConstants } from "@/constants/bangumi";
import {
  BangumiError,
  type BangumiInclude,
  type BangumiSearchItem,
  type BangumiSearchKind,
  type BangumiPersonDetail,
  type BangumiSearchResult,
  type BangumiSearchOptions,
  type BangumiSubjectDetail,
  type BangumiCharacterDetail,
  BangumiSearchResponseSchema
} from "@/types/bangumi";
import type { McpToolOutputDetail } from "@/types/tool";

import {
  formatWorks,
  formatPersonBrief,
  formatPersonRoles,
  formatPersonDetail,
  formatSubjectBrief,
  formatSubjectDetail,
  formatCharacterBrief,
  formatSubjectPersons,
  formatCharacterActors,
  formatCharacterDetail,
  formatSubjectCharacters
} from "./bangumi-format";

/** Bangumi 的错误响应体：只关心能转述给模型的描述字段。 */
const BangumiErrorBodySchema = z.object({ description: z.string(), title: z.string() }).partial();

/**
 * Bangumi 公开 API 客户端：只做匿名读取，覆盖条目/角色/人物的搜索与 wiki 详情
 * 1. 必须走 Electron net.fetch。api.bgm.tv 在部分网络下 DNS 被污染，Node 的 fetch
 *    不读系统代理会直接超时；net.fetch 走 Chromium 网络栈才会跟随代理
 * 2. 必须带 User-Agent，否则 403 Please set a 'User-Agent'
 * 3. 搜索分页 limit 上限 20、total 上限 1000
 */
export class BangumiAPI {
  private static cache = new Map<string, { value: unknown; expiresAt: number }>();
  /** 网络层熔断：DNS 被拦截或代理不通时，后续调用立即失败，把 Agent 推向网页搜索。 */
  private static unreachable?: { until: number; reason: string };

  static async search(
    kind: BangumiSearchKind,
    query: string,
    options: BangumiSearchOptions,
    detail: McpToolOutputDetail,
    signal?: AbortSignal
  ): Promise<BangumiSearchResult> {
    const keyword = query.trim();
    if (!keyword) throw new BangumiError("invalid_input", "搜索关键词不能为空");

    // limit
    const limits = MainBangumiConstants.SEARCH_LIMITS[detail];
    const limit = clamp(options.limit ?? limits.items, 1, limits.items);
    const offset = clamp(options.offset ?? 0, 0, MainBangumiConstants.SEARCH_OFFSET_MAX);

    // body
    const body: Record<string, unknown> = { keyword };
    if (options.sort) body["sort"] = options.sort;
    if (kind === "subject") {
      const types = (options.kinds ?? [])
        .map((item) => MainBangumiConstants.SubjectKindTypes[item])
        .filter((item) => item !== undefined);
      if (types.length) body["filter"] = { type: types };
    } else if (kind === "person" && options.career?.length) {
      body["filter"] = { career: options.career };
    }

    // request
    const raw = await BangumiAPI.request(MainBangumiConstants.SearchPaths[kind], {
      method: "POST",
      query: { limit, offset },
      body,
      signal
    });
    const page = BangumiSearchResponseSchema.parse(raw);
    const rows = page.data;
    const total = page.total ?? rows.length;
    const items: BangumiSearchItem[] = [];
    for (const row of rows) {
      const item =
        kind === "subject"
          ? formatSubjectBrief(row, limits)
          : kind === "character"
            ? formatCharacterBrief(row, limits)
            : formatPersonBrief(row, limits);
      if (item) items.push(item);
    }
    // limit 是否被严格遵守不作假设，这里再兜一次底
    const limited = items.slice(0, limit);

    return {
      kind,
      query: keyword,
      total,
      offset,
      returned: limited.length,
      hasMore: offset + limited.length < Math.min(total, MainBangumiConstants.SEARCH_TOTAL_MAX),
      totalCapped: total >= MainBangumiConstants.SEARCH_TOTAL_MAX ? true : undefined,
      items: limited
    };
  }

  static async subject(
    id: number,
    detail: McpToolOutputDetail,
    includes: readonly BangumiInclude[],
    signal?: AbortSignal
  ): Promise<BangumiSubjectDetail> {
    const limits = MainBangumiConstants.DETAIL_LIMITS[detail];

    const [raw, characters, staff] = await Promise.all([
      BangumiAPI.request(`${MainBangumiConstants.DetailPaths.subject}/${id}`, {
        method: "GET",
        signal
      }),
      includes.includes("characters")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.subject}/${id}/characters`, {
            method: "GET",
            signal
          })
        : undefined,
      includes.includes("staff")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.subject}/${id}/persons`, {
            method: "GET",
            signal
          })
        : undefined
    ]);

    const subject = formatSubjectDetail(raw, limits);
    if (!subject) throw new BangumiError("not_found", `Bangumi 没有 id=${id} 的条目`);
    if (characters !== undefined)
      subject.characters = formatSubjectCharacters(characters, limits.related);
    if (staff !== undefined) subject.staff = formatSubjectPersons(staff, limits.related);

    return subject;
  }

  static async character(
    id: number,
    detail: McpToolOutputDetail,
    includes: readonly BangumiInclude[],
    signal?: AbortSignal
  ): Promise<BangumiCharacterDetail> {
    const limits = MainBangumiConstants.DETAIL_LIMITS[detail];

    const [raw, works, actors] = await Promise.all([
      BangumiAPI.request(`${MainBangumiConstants.DetailPaths.character}/${id}`, {
        method: "GET",
        signal
      }),
      includes.includes("works")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.character}/${id}/subjects`, {
            method: "GET",
            signal
          })
        : undefined,
      includes.includes("actors")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.character}/${id}/persons`, {
            method: "GET",
            signal
          })
        : undefined
    ]);

    const character = formatCharacterDetail(raw, limits);
    if (!character) throw new BangumiError("not_found", `Bangumi 没有 id=${id} 的角色`);
    if (works !== undefined) character.works = formatWorks(works, limits.related);
    if (actors !== undefined)
      character.actors = formatCharacterActors(
        actors,
        Math.min(MainBangumiConstants.RELATED_LIMIT.actors, limits.related)
      );

    return character;
  }

  static async person(
    id: number,
    detail: McpToolOutputDetail,
    includes: readonly BangumiInclude[],
    signal?: AbortSignal
  ): Promise<BangumiPersonDetail> {
    const limits = MainBangumiConstants.DETAIL_LIMITS[detail];

    const [raw, works, roles] = await Promise.all([
      BangumiAPI.request(`${MainBangumiConstants.DetailPaths.person}/${id}`, {
        method: "GET",
        signal
      }),
      includes.includes("works")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.person}/${id}/subjects`, {
            method: "GET",
            signal
          })
        : undefined,
      includes.includes("roles")
        ? BangumiAPI.request(`${MainBangumiConstants.DetailPaths.person}/${id}/characters`, {
            method: "GET",
            signal
          })
        : undefined
    ]);

    const person = formatPersonDetail(raw, limits);
    if (!person) throw new BangumiError("not_found", `Bangumi 没有 id=${id} 的人物`);
    if (works !== undefined) person.works = formatWorks(works, limits.related);
    if (roles !== undefined)
      person.roles = formatPersonRoles(
        roles,
        Math.min(MainBangumiConstants.RELATED_LIMIT.roles, limits.related)
      );

    return person;
  }

  /** 清空网络熔断与响应缓存，供测试隔离不同请求场景。生产环境在熔断窗口后自动恢复。 */
  static resetTransport(): void {
    BangumiAPI.unreachable = undefined;
    BangumiAPI.cache.clear();
  }

  /** 统一入口：缓存、超时、UA、错误映射都在这里，业务方法只组装路径与投影。 */
  private static async request(
    path: string,
    init: {
      body?: unknown;
      signal?: AbortSignal;
      method: "GET" | "POST";
      query?: Record<string, number | string | undefined>;
    }
  ): Promise<unknown> {
    const url = new URL(path, MainBangumiConstants.API_ORIGIN);
    for (const [key, value] of Object.entries(init.query ?? {}))
      value !== undefined && url.searchParams.set(key, String(value));

    const payload = init.body === undefined ? undefined : JSON.stringify(init.body);
    const cacheKey = `${init.method} ${url.pathname}${url.search}${payload ? ` ${payload}` : ""}`;

    const cached = BangumiAPI.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      BangumiAPI.cache.delete(cacheKey);
      BangumiAPI.cache.set(cacheKey, cached);
      return cached.value;
    }

    if (init.signal?.aborted) throw new BangumiError("aborted", "Bangumi 请求已取消");
    BangumiAPI.assertReachable();

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, MainBangumiConstants.REQUEST_TIMEOUT_MS);
    const forwardAbort = () => controller.abort();
    init.signal?.addEventListener("abort", forwardAbort, { once: true });

    try {
      let response: Response;
      try {
        response = await net.fetch(url.href, {
          method: init.method,
          headers: {
            "User-Agent": BangumiAPI.userAgent(),
            Accept: "application/json",
            ...(payload === undefined ? {} : { "Content-Type": "application/json" })
          },
          body: payload,
          signal: controller.signal
        });
      } catch (error) {
        if (init.signal?.aborted) throw new BangumiError("aborted", "Bangumi 请求已取消");
        // 连接阶段的失败没有重试价值：立刻熔断，让调用方改走网页搜索
        throw BangumiAPI.markUnreachable(
          timedOut
            ? `DNS 解析或连接在 ${MainBangumiConstants.REQUEST_TIMEOUT_MS}ms 内无响应`
            : BangumiAPI.describeNetworkFailure(error)
        );
      }
      BangumiAPI.unreachable = undefined;

      if (response.status === 404) throw new BangumiError("not_found", "Bangumi 没有对应的资源");
      if (!response.ok) {
        const description = await BangumiAPI.readErrorDescription(response);
        if (response.status === 400)
          throw new BangumiError("invalid_input", `Bangumi 拒绝了请求：${description}`);
        if (response.status === 429)
          throw new BangumiError("rate_limited", "Bangumi 请求过于频繁，请稍后再试");
        throw new BangumiError("service", `Bangumi 返回 HTTP ${response.status}：${description}`);
      }

      let value: unknown;
      try {
        value = await response.json();
      } catch {
        // 响应体读取同样受超时与取消约束，不能一律当成“数据损坏”。
        if (init.signal?.aborted) throw new BangumiError("aborted", "Bangumi 请求已取消");
        if (timedOut)
          throw BangumiAPI.markUnreachable(
            `响应体在 ${MainBangumiConstants.REQUEST_TIMEOUT_MS}ms 内未读取完`
          );
        throw new BangumiError("service", "Bangumi 返回了无法解析的数据");
      }

      BangumiAPI.store(cacheKey, value);
      return value;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", forwardAbort);
    }
  }

  private static unreachableMessage(reason: string): string {
    return `Bangumi 网络不可达（${reason}）。请改用网页搜索工具 agent-tool-web-snapshot（search / read_page）检索同一内容，不要重复调用本工具。`;
  }

  /** Chromium 只给出 net::ERR_* 代码，这里翻译成 Agent 能据此决策的说法 */
  private static describeNetworkFailure(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const code = raw.match(/net::(ERR_[A-Z_]+)/)?.[1];
    switch (code) {
      case "ERR_NAME_NOT_RESOLVED":
      case "ERR_NAME_RESOLUTION_FAILED":
        return "DNS 解析失败，很可能被网络环境拦截";
      case "ERR_PROXY_CONNECTION_FAILED":
      case "ERR_TUNNEL_CONNECTION_FAILED":
        return "系统代理不可用或被拒绝";
      case "ERR_INTERNET_DISCONNECTED":
        return "当前没有网络连接";
      case "ERR_CONNECTION_TIMED_OUT":
      case "ERR_TIMED_OUT":
        return "连接超时，很可能被网络环境拦截";
      case "ERR_CONNECTION_CLOSED":
      case "ERR_CONNECTION_RESET":
      case "ERR_CONNECTION_REFUSED":
        return "连接被中断，很可能被网络环境拦截";
      default:
        return code ? `连接失败（${code}）` : raw.slice(0, 120) || "连接失败";
    }
  }

  private static async readErrorDescription(response: Response): Promise<string> {
    let text = "";
    try {
      text = (await response.text()).trim();
    } catch {
      return response.statusText || "无描述";
    }
    if (!text) return response.statusText || "无描述";
    const body = BangumiErrorBodySchema.safeParse(parseJSON(text));
    if (body.success) {
      const description = body.data.description ?? body.data.title;
      if (description?.trim()) return description.trim().slice(0, 200);
    }
    // 非 JSON 错误页直接截断原文。
    return text.slice(0, 200);
  }

  private static assertReachable(): void {
    const blocked = BangumiAPI.unreachable;
    if (blocked && blocked.until > Date.now())
      throw new BangumiError("unreachable", BangumiAPI.unreachableMessage(blocked.reason));
  }

  private static markUnreachable(reason: string): BangumiError {
    BangumiAPI.unreachable = {
      reason,
      until: Date.now() + MainBangumiConstants.UNREACHABLE_COOLDOWN_MS
    };
    return new BangumiError("unreachable", BangumiAPI.unreachableMessage(reason));
  }

  private static userAgent(): string {
    let version = "0.0.0";
    try {
      version = app.getVersion();
    } catch {
      // app 尚未就绪时保留占位版本号，UA 仍满足 Bangumi 的可识别要求
    }
    return `AiraMusic/${version} ${MainBangumiConstants.USER_AGENT_CONTACT}`;
  }

  private static store(key: string, value: unknown): void {
    let size = 0;
    try {
      size = JSON.stringify(value)?.length ?? 0;
    } catch {
      return;
    }
    if (size > MainBangumiConstants.CACHE_ENTRY_MAX_CHARS) return;
    if (BangumiAPI.cache.size >= MainBangumiConstants.CACHE_ENTRY_LIMIT) {
      const oldest = BangumiAPI.cache.keys().next().value;
      if (oldest !== undefined) BangumiAPI.cache.delete(oldest);
    }
    BangumiAPI.cache.set(key, {
      expiresAt: Date.now() + MainBangumiConstants.CACHE_TTL_MS,
      value
    });
  }
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
