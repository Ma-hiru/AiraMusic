import { z } from "zod";
import { MainIPC } from "@mahiru/ipc/main";
import { AIResult, type LLMToolContext } from "@mahiru/ai";
import type { MessageData } from "@mahiru/ipc/types";

type AgentToolRequestData = MessageData<"message_dispatch_agent_tool_request">;
type AgentToolResponseData = MessageData<"message_deliver_agent_tool_response">;
type AgentToolName = AgentToolRequestData["tool"];
type AgentToolInput<TTool extends AgentToolName> = Extract<
  AgentToolRequestData,
  { tool: TTool }
>["input"];

const AgentToolRequestTimeoutMs = 15_000;

const requestAgentTool = <TTool extends AgentToolName>(
  context: LLMToolContext,
  tool: TTool,
  input: AgentToolInput<TTool>
): Promise<AIResult<JsonValue>> => {
  if (context.signal?.aborted) {
    return Promise.resolve(
      AIResult.err({
        type: "aborted",
        message: `工具请求已取消：${tool}`
      })
    );
  }

  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    let settled = false;

    const settle = (result: AIResult<JsonValue>) => {
      if (settled) return;
      settled = true;
      timeout && clearTimeout(timeout);
      unsubscribeResponse();
      context.signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      settle(
        AIResult.err({
          type: "aborted",
          message: `工具请求已取消：${tool}`
        })
      );
    };
    const timeout = setTimeout(() => {
      settle(
        AIResult.err({
          type: "timeout",
          message: `工具请求超时：${tool}`
        })
      );
    }, AgentToolRequestTimeoutMs);
    const unsubscribeResponse = MainIPC.MessageChannel.listen(
      "message_deliver_agent_tool_response",
      (response: AgentToolResponseData) => {
        if (response.id !== id) return;
        if (response.ok) {
          settle(AIResult.ok(response.data));
          return;
        }
        settle(
          AIResult.err({
            type: "invalid_tool_call",
            message: response.reason
          })
        );
      }
    );

    context.signal?.addEventListener("abort", abort, { once: true });
    MainIPC.MessageChannel.commit({
      sender: "process",
      receiver: "main",
      type: "message_dispatch_agent_tool_request",
      data: {
        id,
        conversationID: context.conversationID,
        tool,
        input
      } as Extract<AgentToolRequestData, { tool: TTool }>
    });
  });
};

export class AgentToolTrackDetail {
  readonly name = "agent-tool-track-detail";
  readonly description =
    "获取指定 ID 的歌曲详情，尽可能一次性放入所有id，单独请求效率比一次性请求低，频繁请求可能网络错误";

  inputSchema = z.object({
    ids: z.array(z.number()).describe("歌曲 ID 列表"),
    mode: z
      .enum(["simple", "detail"])
      .default("simple")
      .describe("请求模式, simple 只返回基本信息，detail 返回详细信息")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-detail", input);
  }
}

export class AgentToolTrackPlayable {
  readonly name = "agent-tool-track-playable";
  readonly description = "检查指定 ID 的歌曲是否可播放，即有无播放权限或版权";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-playable", input);
  }
}

export class AgentToolTrackLyrics {
  readonly name = "agent-tool-track-lyrics";
  readonly description = "获取指定 ID 的歌曲歌词";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-lyrics", input);
  }
}

export class AgentToolTrackSimilar {
  readonly name = "agent-tool-track-similar";
  readonly description = "获取指定 ID 的歌曲相似歌曲";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-similar", input);
  }
}

export class AgentToolTrackPlay {
  readonly name = "agent-tool-track-play";
  readonly description = "播放指定 ID 的歌曲";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-play", input);
  }
}

export class AgentToolComment {
  readonly name = "agent-tool-track-comment";
  readonly description = "获取指定资源的评论";

  inputSchema = z.object({
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "playlist", "album"]).describe("资源类型"),
    page: z.number().min(1).max(100).default(1).describe("页码"),
    pageSize: z.number().min(1).max(100).default(20).describe("每页数量"),
    sort: z.enum(["new", "hot", "recommend"]).default("hot").describe("排序方式")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-comment", input);
  }
}

export class AgentToolAlbumDetail {
  readonly name = "agent-tool-album-detail";
  readonly description = "获取指定 ID 的专辑详情";

  inputSchema = z.object({
    id: z.number().describe("专辑 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-album-detail", input);
  }
}

export class AgentToolArtistDetail {
  readonly name = "agent-tool-artist-detail";
  readonly description = "获取指定 ID 的艺术家详情";

  inputSchema = z.object({
    id: z.number().describe("艺术家 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-detail", input);
  }
}

export class AgentToolPlaylistDetail {
  readonly name = "agent-tool-playlist-detail";
  readonly description = "获取指定 ID 的歌单详情";

  inputSchema = z.object({
    id: z.number().describe("歌单 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-detail", input);
  }
}

export class AgentToolPlayerAction {
  readonly name = "agent-tool-player-action";
  readonly description =
    "执行播放器操作，如播放、暂停、下一首、上一首、随机播放、重复播放、切换播放模式等";

  private readonly actions = [
    "exit",
    "next",
    "play",
    "pause",
    "update",
    "previous",
    "toggle-lyric-version-rm",
    "toggle-lyric-version-tl"
  ] satisfies MessageData<"bus_dispatch_player_action">[];

  readonly inputSchema = z.object({
    action: z.enum(this.actions).describe("播放器操作")
  });

  async execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-player-action", input);
  }
}

export class AgentToolChangeSettings {
  readonly name = "agent-tool-change-settings";
  readonly description = "修改指定设置的值";

  inputSchema = z.object({
    key: z.string().describe("设置键名"),
    value: z.any().describe("设置值")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-change-settings", {
      key: input.key,
      value: input.value as JsonValue
    });
  }
}

export class AgentToolSearch {
  readonly name = "agent-search";
  readonly description = "搜索指定类型和关键字的资源";

  inputSchema = z.object({
    keyword: z.string(),
    type: z.enum(["track", "playlist", "album", "artist"]),
    page: z.number().min(1).max(100).default(1),
    pageSize: z.number().min(1).max(100).default(20)
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-search", input);
  }
}

export class AgentToolLyricSchema {
  readonly name = "agent-lyric-schema";
  readonly description = "获取当前播放的歌词的 JSON 数据结构";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-lyric-schema", input);
  }
}

export class AgentToolReplaceLyrics {
  readonly name = "agent-tool-replace-lyrics";
  readonly description = "替换当前播放的歌词的翻译或罗马音";

  inputSchema = z.object({
    content: z
      .string()
      .describe(
        "新歌词 JSON 数据字符串，解析时直接使用该字符串，不做额外包装，格式 schema 应从 agent-lyric-schema 获取"
      )
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-replace-lyrics", input);
  }
}

export class AgentToolSourceOpen {
  readonly name = "agent-tool-source-open";
  readonly description = "打开程序内部指定的资源界面";

  inputSchema = z.object({
    type: z.enum(["playlist", "album", "artist"]).describe("界面类型"),
    id: z.number().describe("资源 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-source-open", input);
  }
}

export class AgentToolCommentOpen {
  readonly name = "agent-tool-comment-open";
  readonly description = "打开程序内部指定的评论界面";

  inputSchema = z.object({
    type: z.enum(["playlist", "album", "track"]).describe("资源类型"),
    id: z.number().describe("资源 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-comment-open", input);
  }
}

export class AgentToolSearchOpen {
  readonly name = "agent-tool-search-open";
  readonly description = "打开程序内部指定的搜索界面";

  inputSchema = z.object({
    keyword: z.string().describe("搜索关键字")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-search-open", input);
  }
}

// todo: 以下tool还未逐一测试

export class AgentToolPlayerCurrent {
  readonly name = "agent-tool-player-current";
  readonly description = "获取当前播放器状态，包括当前播放曲目、播放进度、音量、循环/随机模式等";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-player-current", input);
  }
}

export class AgentToolPlayerVolume {
  readonly name = "agent-tool-player-volume";
  readonly description = "设置播放器音量（0-100）或切换静音状态";

  inputSchema = z.object({
    volume: z.number().min(0).max(100).optional().describe("音量百分比 0-100"),
    mute: z.boolean().optional().describe("true 静音，false 取消静音")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-player-volume", input);
  }
}

export class AgentToolPlayerSeek {
  readonly name = "agent-tool-player-seek";
  readonly description = "跳转到当前歌曲的指定位置，支持秒数或百分比（如 '50%'）";

  inputSchema = z.object({
    position: z.union([z.number(), z.string()]).describe("跳转位置，秒数或百分比字符串如 '50%'")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-player-seek", input);
  }
}

export class AgentToolPlayerQueue {
  readonly name = "agent-tool-player-queue";
  readonly description = "获取当前播放队列中的所有歌曲";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-player-queue", input);
  }
}

export class AgentToolUserInfo {
  readonly name = "agent-tool-user-info";
  readonly description = "获取当前登录用户的信息，包括昵称、头像、VIP 状态等";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-user-info", input);
  }
}

export class AgentToolUserPlaylists {
  readonly name = "agent-tool-user-playlists";
  readonly description =
    "获取指定用户的歌单列表（创建和收藏的），不传 uid 则获取当前登录用户的歌单";

  inputSchema = z.object({
    uid: z.number().optional().describe("用户 ID，不传则获取当前用户"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-user-playlists", input);
  }
}

export class AgentToolUserPlayHistory {
  readonly name = "agent-tool-user-play-history";
  readonly description = "获取用户的播放历史记录，需要登录";

  inputSchema = z.object({
    uid: z.number().describe("用户 ID"),
    type: z.enum(["0", "1"]).default("0").describe("0 返回所有数据，1 仅返回周数据")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-user-play-history", {
      uid: input.uid,
      type: Number(input.type) as 0 | 1
    });
  }
}

export class AgentToolTrackLike {
  readonly name = "agent-tool-track-like";
  readonly description = "喜欢或取消喜欢指定歌曲";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID"),
    like: z.boolean().describe("true 喜欢，false 取消喜欢")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-like", input);
  }
}

export class AgentToolTrackRecommendDaily {
  readonly name = "agent-tool-track-recommend-daily";
  readonly description = "获取每日推荐歌曲，需要登录";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-recommend-daily", input);
  }
}

export class AgentToolTrackRecommendNew {
  readonly name = "agent-tool-track-recommend-new";
  readonly description = "获取新歌速递，可按地区筛选。全部:0 华语:7 欧美:96 日本:8 韩国:16";

  inputSchema = z.object({
    type: z
      .union([z.literal(0), z.literal(7), z.literal(8), z.literal(16), z.literal(96)])
      .default(0)
      .optional()
      .describe("地区类型：0 全部，7 华语，96 欧美，8 日本，16 韩国")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-recommend-new", input);
  }
}

export class AgentToolTrackFM {
  readonly name = "agent-tool-track-fm";
  readonly description = "获取私人 FM 推荐歌曲，需要登录";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-track-fm", input);
  }
}

export class AgentToolFMTrash {
  readonly name = "agent-tool-fm-trash";
  readonly description = "将指定歌曲从私人 FM 中移除至垃圾桶";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-fm-trash", input);
  }
}

export class AgentToolArtistHotTracks {
  readonly name = "agent-tool-artist-hot-tracks";
  readonly description = "获取指定艺人的热门 50 首歌曲";

  inputSchema = z.object({
    id: z.number().describe("艺人 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-hot-tracks", input);
  }
}

export class AgentToolArtistAlbums {
  readonly name = "agent-tool-artist-albums";
  readonly description = "获取指定艺人的所有专辑";

  inputSchema = z.object({
    id: z.number().describe("艺人 ID"),
    page: z.number().min(1).default(1).optional().describe("页码"),
    pageSize: z.number().min(1).max(100).default(30).optional().describe("每页数量")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-albums", input);
  }
}

export class AgentToolArtistSimilar {
  readonly name = "agent-tool-artist-similar";
  readonly description = "获取与指定艺人相似的艺人";

  inputSchema = z.object({
    id: z.number().describe("艺人 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-similar", input);
  }
}

export class AgentToolArtistToplist {
  readonly name = "agent-tool-artist-toplist";
  readonly description = "获取歌手排行榜。1 华语，2 欧美，3 韩国，4 日本；不传为全部";

  inputSchema = z.object({
    type: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe("地区：1 华语，2 欧美，3 韩国，4 日本；不传为全部")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-toplist", input);
  }
}

export class AgentToolArtistDesc {
  readonly name = "agent-tool-artist-desc";
  readonly description = "获取指定艺人的详细描述和简介";

  inputSchema = z.object({
    id: z.number().describe("艺人 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-artist-desc", input);
  }
}

export class AgentToolPlaylistRecommend {
  readonly name = "agent-tool-playlist-recommend";
  readonly description = "获取个性化推荐歌单";

  inputSchema = z.object({
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-recommend", input);
  }
}

export class AgentToolPlaylistCreate {
  readonly name = "agent-tool-playlist-create";
  readonly description = "创建一个新的歌单，需要登录";

  inputSchema = z.object({
    name: z.string().min(1).max(100).describe("歌单名称"),
    privacy: z.literal(10).optional().describe("传 10 则创建为隐私歌单，不传则公开")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-create", input);
  }
}

export class AgentToolPlaylistDelete {
  readonly name = "agent-tool-playlist-delete";
  readonly description = "删除指定歌单，需要登录且为歌单创建者";

  inputSchema = z.object({
    id: z.number().describe("歌单 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-delete", input);
  }
}

export class AgentToolPlaylistModify {
  readonly name = "agent-tool-playlist-modify";
  readonly description = "向歌单添加或删除歌曲，需要登录且为歌单创建者";

  inputSchema = z.object({
    op: z.enum(["add", "del"]).describe("add 添加歌曲，del 删除歌曲"),
    pid: z.number().describe("歌单 ID"),
    trackIds: z.array(z.number()).describe("歌曲 ID 列表")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-modify", input);
  }
}

export class AgentToolPlaylistStar {
  readonly name = "agent-tool-playlist-star";
  readonly description = "收藏或取消收藏歌单";

  inputSchema = z.object({
    id: z.number().describe("歌单 ID"),
    subscribe: z.boolean().describe("true 收藏，false 取消收藏")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-star", input);
  }
}

export class AgentToolPlaylistSimilar {
  readonly name = "agent-tool-playlist-similar";
  readonly description = "获取与指定歌单相似的歌单";

  inputSchema = z.object({
    id: z.number().describe("歌单 ID")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-similar", input);
  }
}

export class AgentToolPlaylistTop {
  readonly name = "agent-tool-playlist-top";
  readonly description = "获取网友精选碟歌单，可按分类和排序筛选";

  inputSchema = z.object({
    cat: z.string().optional().describe("分类标签，如 '华语'、'古风'、'欧美'、'流行'，默认为全部"),
    order: z
      .enum(["hot", "new"])
      .default("hot")
      .optional()
      .describe("排序方式，hot 最热，new 最新"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-playlist-top", input);
  }
}

export class AgentToolAlbumNew {
  readonly name = "agent-tool-album-new";
  readonly description = "获取最新上架的专辑";

  inputSchema = z.object({
    area: z
      .enum(["ALL", "ZH", "EA", "KR", "JP"])
      .default("ALL")
      .optional()
      .describe("地区：ALL 全部，ZH 华语，EA 欧美，KR 韩国，JP 日本"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-album-new", input);
  }
}

export class AgentToolAlbumStar {
  readonly name = "agent-tool-album-star";
  readonly description = "收藏或取消收藏专辑";

  inputSchema = z.object({
    id: z.number().describe("专辑 ID"),
    subscribe: z.boolean().describe("true 收藏，false 取消收藏")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-album-star", input);
  }
}

export class AgentToolCommentSend {
  readonly name = "agent-tool-comment-send";
  readonly description = "发送评论到指定资源（歌曲/专辑/歌单），需要登录";

  inputSchema = z.object({
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "album", "playlist"]).describe("资源类型"),
    content: z.string().min(1).max(1000).describe("评论内容"),
    commentId: z.number().optional().describe("回复目标评论 ID，用于回复评论")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-comment-send", input);
  }
}

export class AgentToolCommentLike {
  readonly name = "agent-tool-comment-like";
  readonly description = "点赞或取消点赞评论，需要登录";

  inputSchema = z.object({
    cid: z.number().describe("评论 ID"),
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "album", "playlist"]).describe("资源类型"),
    like: z.boolean().describe("true 点赞，false 取消点赞")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-comment-like", input);
  }
}

export class AgentToolSearchHot {
  readonly name = "agent-tool-search-hot";
  readonly description = "获取当前热搜关键词列表";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-search-hot", input);
  }
}

export class AgentToolSearchSuggest {
  readonly name = "agent-tool-search-suggest";
  readonly description = "获取搜索建议，输入部分关键词即可获得补全建议";

  inputSchema = z.object({
    keyword: z.string().min(1).describe("搜索关键词")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-search-suggest", input);
  }
}

export class AgentToolHomeToplists {
  readonly name = "agent-tool-home-toplists";
  readonly description = "获取所有官方音乐排行榜和榜单";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-home-toplists", input);
  }
}

export class AgentToolSettingsGet {
  readonly name = "agent-tool-settings-get";
  readonly description = "获取当前应用的设置信息";

  inputSchema = z.object();

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-settings-get", input);
  }
}

export class AgentToolRecord {
  readonly name = "agent-tool-record";
  readonly description = "获取听歌统计数据，支持今日、总计、本周、本月。需要登录";

  inputSchema = z.object({
    type: z
      .enum(["today", "total", "week", "month"])
      .describe("统计类型：today 今日，total 总计，week 本周，month 本月")
  });

  execute(
    input: z.infer<typeof this.inputSchema>,
    context: LLMToolContext
  ): Promise<AIResult<JsonValue>> {
    return requestAgentTool(context, "agent-tool-record", input);
  }
}
