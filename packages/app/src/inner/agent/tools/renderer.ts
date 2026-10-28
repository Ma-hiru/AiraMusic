import { z } from "zod";
import { MainAgentTool } from "@/lib/agent/tool";
import { McpToolRisk, type McpTool } from "@/types/tool";

export const AgentToolTrackDetail = MainAgentTool.createRendererTool({
  name: "agent-tool-track-detail",
  description:
    "获取指定 ID 的歌曲详情，尽可能一次性放入所有id，单独请求效率比一次性请求低，频繁请求可能网络错误",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    ids: z
      .array(z.number().int().positive())
      .min(1)
      .max(100)
      .describe("歌曲 ID 列表，单次最多查询 100 首"),
    mode: z
      .enum(["simple", "detail"])
      .default("simple")
      .describe("请求模式, simple 只返回基本信息，detail 返回详细信息")
  })
});

export const AgentToolTrackPlayable = MainAgentTool.createRendererTool({
  name: "agent-tool-track-playable",
  description: "检查指定 ID 的歌曲是否可播放，即有无播放权限或版权",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID")
  })
});

export const AgentToolTrackLyrics = MainAgentTool.createRendererTool({
  name: "agent-tool-track-lyrics",
  description:
    "获取指定 ID 的歌曲歌词；semantic 用于阅读和分析，editable 仅在需要逐字时间轴或修改歌词时使用",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID"),
    mode: z.enum(["semantic", "editable"]).default("semantic").describe("歌词返回模式")
  })
});

export const AgentToolTrackSimilar = MainAgentTool.createRendererTool({
  name: "agent-tool-track-similar",
  description: "获取指定 ID 的歌曲相似歌曲",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID")
  })
});

export const AgentToolTrackPlay = MainAgentTool.createRendererTool({
  name: "agent-tool-track-play",
  description: "播放指定 ID 的歌曲",
  risk: McpToolRisk.Write,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID")
  })
});

export const AgentToolComment = MainAgentTool.createRendererTool({
  name: "agent-tool-track-comment",
  description: "获取指定资源的评论",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "playlist", "album"]).describe("资源类型"),
    page: z.number().min(1).max(100).default(1).describe("页码"),
    pageSize: z.number().min(1).max(20).default(10).describe("每页数量"),
    sort: z.enum(["new", "hot", "recommend"]).default("hot").describe("排序方式")
  })
});

export const AgentToolAlbumDetail = MainAgentTool.createRendererTool({
  name: "agent-tool-album-detail",
  description: "获取指定 ID 的专辑详情",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("专辑 ID")
  })
});

export const AgentToolArtistDetail = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-detail",
  description: "获取指定 ID 的艺术家详情",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("艺术家 ID")
  })
});

export const AgentToolPlaylistDetail = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-detail",
  description: "获取指定 ID 的歌单详情",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("歌单 ID")
  })
});

export const AgentToolPlayerAction = MainAgentTool.createRendererTool({
  name: "agent-tool-player-action",
  description: "执行即时播放器操作，包括播放、暂停、上一首、下一首，以及切换歌词翻译或罗马音显示",
  risk: McpToolRisk.Write,
  timeoutMs: 5000,
  inputSchema: z.object({
    action: z
      .enum([
        "next",
        "play",
        "pause",
        "previous",
        "toggle-lyric-version-rm",
        "toggle-lyric-version-tl"
      ])
      .describe("播放器操作")
  })
});

export const AgentToolChangeSettings = MainAgentTool.createRendererTool({
  name: "agent-tool-change-settings",
  description: "修改指定设置的值",
  risk: McpToolRisk.Destructive,
  timeoutMs: 5000,
  inputSchema: z.object({
    key: z.string().describe("设置键名"),
    value: z.any().describe("设置值")
  })
});

export const AgentToolSearch = MainAgentTool.createRendererTool({
  name: "agent-search",
  description: "搜索指定类型和关键字的资源",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    keyword: z.string(),
    type: z.enum(["track", "playlist", "album", "artist"]),
    page: z.number().min(1).max(100).default(1),
    pageSize: z.number().min(1).max(20).default(10)
  })
});

export const AgentToolLyricSchema = MainAgentTool.createRendererTool({
  name: "agent-lyric-schema",
  description: "获取当前播放的歌词的 JSON 数据结构",
  risk: McpToolRisk.Read,
  timeoutMs: 5000,
  inputSchema: z.object()
});

export const AgentToolReplaceLyrics = MainAgentTool.createRendererTool({
  name: "agent-tool-replace-lyrics",
  description: "替换当前播放的歌词的翻译或罗马音",
  risk: McpToolRisk.Destructive,
  timeoutMs: 5000,
  inputSchema: z.object({
    content: z
      .string()
      .describe(
        "新歌词 JSON 数据字符串，解析时直接使用该字符串，不做额外包装，格式 schema 应从 agent-lyric-schema 获取"
      )
  })
});

export const AgentToolSourceOpen = MainAgentTool.createRendererTool({
  name: "agent-tool-source-open",
  description: "打开程序内部指定的资源界面",
  risk: McpToolRisk.Write,
  timeoutMs: 10000,
  commitUnknownOnTimeout: false,
  inputSchema: z.object({
    type: z.enum(["playlist", "album", "artist"]).describe("界面类型"),
    id: z.number().describe("资源 ID")
  })
});

export const AgentToolCommentOpen = MainAgentTool.createRendererTool({
  name: "agent-tool-comment-open",
  description: "打开程序内部指定的评论界面",
  risk: McpToolRisk.Write,
  timeoutMs: 10000,
  commitUnknownOnTimeout: false,
  inputSchema: z.object({
    type: z.enum(["playlist", "album", "track"]).describe("资源类型"),
    id: z.number().describe("资源 ID")
  })
});

export const AgentToolSearchOpen = MainAgentTool.createRendererTool({
  name: "agent-tool-search-open",
  description: "打开程序内部指定的搜索界面",
  risk: McpToolRisk.Write,
  timeoutMs: 10000,
  commitUnknownOnTimeout: false,
  inputSchema: z.object({
    keyword: z.string().describe("搜索关键字")
  })
});

export const AgentToolPlayerCurrent = MainAgentTool.createRendererTool({
  name: "agent-tool-player-current",
  description: "获取当前播放器状态，包括当前播放曲目、播放进度、音量、循环/随机模式等",
  risk: McpToolRisk.Read,
  timeoutMs: 5000,
  inputSchema: z.object()
});

export const AgentToolPlayerVolume = MainAgentTool.createRendererTool({
  name: "agent-tool-player-volume",
  description: "设置播放器音量（0-100）或切换静音状态",
  risk: McpToolRisk.Write,
  timeoutMs: 5000,
  inputSchema: z
    .object({
      volume: z.number().min(0).max(100).optional().describe("音量百分比 0-100"),
      mute: z.boolean().optional().describe("true 静音，false 取消静音")
    })
    .refine((input) => input.volume !== undefined || input.mute !== undefined, {
      message: "volume 和 mute 至少提供一个"
    })
});

export const AgentToolPlayerSeek = MainAgentTool.createRendererTool({
  name: "agent-tool-player-seek",
  description: "跳转到当前歌曲的指定位置，支持秒数或百分比（如 '50%'）",
  risk: McpToolRisk.Write,
  timeoutMs: 5000,
  inputSchema: z.object({
    position: z
      .union([z.number().nonnegative(), z.string().regex(/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%$/)])
      .describe("跳转位置，非负秒数或 0%-100% 的百分比字符串，如 '50%'")
  })
});

export const AgentToolPlayerQueue = MainAgentTool.createRendererTool({
  name: "agent-tool-player-queue",
  description: "获取当前播放队列中的所有歌曲",
  risk: McpToolRisk.Read,
  timeoutMs: 5000,
  inputSchema: z.object()
});

export const AgentToolPlayerQueueAdd = MainAgentTool.createRendererTool({
  name: "agent-tool-player-queue-add",
  description:
    "把一首或多首歌曲加入当前播放队列，但不立即切换播放；position=next 表示依次插入当前歌曲之后，position=end 表示追加到队尾",
  risk: McpToolRisk.Write,
  timeoutMs: 30000,
  inputSchema: z.object({
    ids: z
      .array(z.number().int().positive())
      .min(1)
      .max(50)
      .describe("按期望播放顺序排列的歌曲 ID，重复 ID 会自动去重"),
    position: z
      .enum(["next", "end"])
      .default("next")
      .describe("加入位置：next 下一首开始播放，end 队列末尾")
  })
});

export const AgentToolPlayerQueueRemove = MainAgentTool.createRendererTool({
  name: "agent-tool-player-queue-remove",
  description:
    "从当前播放队列移除指定歌曲或清空队列。此操作会改变现有队列，仅在用户允许破坏性工具时可用",
  risk: McpToolRisk.Destructive,
  timeoutMs: 5000,
  mapInput: (input) =>
    input?.scope === "all" ? { scope: "all" } : { scope: "tracks", ids: input?.ids ?? [] },
  inputSchema: z
    .object({
      scope: z.enum(["tracks", "all"]).describe("tracks 移除指定歌曲；all 清空整个队列"),
      ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(50)
        .nullable()
        .describe("scope=tracks 时填写歌曲 ID；scope=all 时必须为 null")
    })
    .strict()
    .superRefine((input, context) => {
      if (input.scope === "tracks" && !input.ids) {
        context.addIssue({ code: "custom", path: ["ids"], message: "移除歌曲时必须提供 ids" });
      }
      if (input.scope === "all" && input.ids !== null) {
        context.addIssue({ code: "custom", path: ["ids"], message: "清空队列时 ids 必须为 null" });
      }
    })
});

export const AgentToolPlayerMode = MainAgentTool.createRendererTool({
  name: "agent-tool-player-mode",
  description:
    "明确设置当前播放模式，可设置循环模式和随机播放；未提供的字段保持原值，至少要提供一个字段",
  risk: McpToolRisk.Write,
  timeoutMs: 5000,
  inputSchema: z
    .object({
      repeat: z
        .enum(["off", "all", "one"])
        .optional()
        .describe("循环模式：off 不循环，all 列表循环，one 单曲循环"),
      shuffle: z.boolean().optional().describe("是否随机播放")
    })
    .refine((input) => input.repeat !== undefined || input.shuffle !== undefined, {
      message: "repeat 和 shuffle 至少提供一个"
    })
});

export const AgentToolUserInfo = MainAgentTool.createRendererTool({
  name: "agent-tool-user-info",
  description: "获取当前登录用户的信息，包括昵称、头像、VIP 状态等",
  risk: McpToolRisk.Read,
  timeoutMs: 5000,
  inputSchema: z.object()
});

export const AgentToolUserPlaylists = MainAgentTool.createRendererTool({
  name: "agent-tool-user-playlists",
  description: "获取指定用户的歌单列表（创建和收藏的），不传 uid 则获取当前登录用户的歌单",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    uid: z.number().optional().describe("用户 ID，不传则获取当前用户"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  })
});

export const AgentToolUserPlayHistory = MainAgentTool.createRendererTool({
  name: "agent-tool-user-play-history",
  description: "获取用户的播放历史记录，需要登录",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  mapInput: (input) => ({ ...input, type: Number(input.type) }),
  inputSchema: z.object({
    uid: z.number().describe("用户 ID"),
    type: z.enum(["0", "1"]).default("0").describe("0 返回所有数据，1 仅返回周数据")
  })
});

export const AgentToolTrackLike = MainAgentTool.createRendererTool({
  name: "agent-tool-track-like",
  description: "喜欢或取消喜欢指定歌曲",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID"),
    like: z.boolean().describe("true 喜欢，false 取消喜欢")
  })
});

export const AgentToolTrackRecommendDaily = MainAgentTool.createRendererTool({
  name: "agent-tool-track-recommend-daily",
  description: "获取每日推荐歌曲，需要登录",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object()
});

export const AgentToolTrackRecommendNew = MainAgentTool.createRendererTool({
  name: "agent-tool-track-recommend-new",
  description: "获取新歌速递，可按地区筛选。全部:0 华语:7 欧美:96 日本:8 韩国:16",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    type: z
      .union([z.literal(0), z.literal(7), z.literal(8), z.literal(16), z.literal(96)])
      .default(0)
      .optional()
      .describe("地区类型：0 全部，7 华语，96 欧美，8 日本，16 韩国")
  })
});

export const AgentToolTrackFM = MainAgentTool.createRendererTool({
  name: "agent-tool-track-fm",
  description: "获取私人 FM 推荐歌曲，需要登录",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object()
});

export const AgentToolFMTrash = MainAgentTool.createRendererTool({
  name: "agent-tool-fm-trash",
  description: "将指定歌曲从私人 FM 中移除至垃圾桶",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("歌曲 ID")
  })
});

export const AgentToolArtistHotTracks = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-hot-tracks",
  description: "获取指定艺人的热门 50 首歌曲",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("艺人 ID")
  })
});

export const AgentToolArtistAlbums = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-albums",
  description: "获取指定艺人的所有专辑",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("艺人 ID"),
    page: z.number().min(1).default(1).optional().describe("页码"),
    pageSize: z.number().min(1).max(100).default(30).optional().describe("每页数量")
  })
});

export const AgentToolArtistSimilar = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-similar",
  description: "获取与指定艺人相似的艺人",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("艺人 ID")
  })
});

export const AgentToolArtistToplist = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-toplist",
  description: "获取歌手排行榜。1 华语，2 欧美，3 韩国，4 日本；不传为全部",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    type: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe("地区：1 华语，2 欧美，3 韩国，4 日本；不传为全部")
  })
});

export const AgentToolArtistDesc = MainAgentTool.createRendererTool({
  name: "agent-tool-artist-desc",
  description: "获取指定艺人的详细描述和简介",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("艺人 ID")
  })
});

export const AgentToolPlaylistRecommend = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-recommend",
  description: "获取个性化推荐歌单",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量")
  })
});

export const AgentToolPlaylistCreate = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-create",
  description: "创建一个新的歌单，需要登录",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    name: z.string().min(1).max(100).describe("歌单名称"),
    privacy: z.literal(10).optional().describe("传 10 则创建为隐私歌单，不传则公开")
  })
});

export const AgentToolPlaylistDelete = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-delete",
  description: "删除指定歌单，需要登录且为歌单创建者",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("歌单 ID")
  })
});

export const AgentToolPlaylistModify = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-modify",
  description: "向歌单添加或删除歌曲，需要登录且为歌单创建者",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    op: z.enum(["add", "del"]).describe("add 添加歌曲，del 删除歌曲"),
    pid: z.number().describe("歌单 ID"),
    trackIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(500)
      .describe("歌曲 ID 列表，单次最多修改 500 首")
  })
});

export const AgentToolPlaylistStar = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-star",
  description: "收藏或取消收藏歌单",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("歌单 ID"),
    subscribe: z.boolean().describe("true 收藏，false 取消收藏")
  })
});

export const AgentToolPlaylistSimilar = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-similar",
  description: "获取与指定歌单相似的歌单",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    id: z.number().describe("歌单 ID")
  })
});

export const AgentToolPlaylistTop = MainAgentTool.createRendererTool({
  name: "agent-tool-playlist-top",
  description: "获取网友精选碟歌单，可按分类和排序筛选",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    cat: z.string().optional().describe("分类标签，如 '华语'、'古风'、'欧美'、'流行'，默认为全部"),
    order: z
      .enum(["hot", "new"])
      .default("hot")
      .optional()
      .describe("排序方式，hot 最热，new 最新"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  })
});

export const AgentToolAlbumNew = MainAgentTool.createRendererTool({
  name: "agent-tool-album-new",
  description: "获取最新上架的专辑",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    area: z
      .enum(["ALL", "ZH", "EA", "KR", "JP"])
      .default("ALL")
      .optional()
      .describe("地区：ALL 全部，ZH 华语，EA 欧美，KR 韩国，JP 日本"),
    limit: z.number().min(1).max(100).default(30).optional().describe("返回数量"),
    offset: z.number().min(0).default(0).optional().describe("偏移量用于分页")
  })
});

export const AgentToolAlbumStar = MainAgentTool.createRendererTool({
  name: "agent-tool-album-star",
  description: "收藏或取消收藏专辑",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("专辑 ID"),
    subscribe: z.boolean().describe("true 收藏，false 取消收藏")
  })
});

export const AgentToolCommentSend = MainAgentTool.createRendererTool({
  name: "agent-tool-comment-send",
  description: "发送评论到指定资源（歌曲/专辑/歌单），需要登录",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "album", "playlist"]).describe("资源类型"),
    content: z.string().min(1).max(1000).describe("评论内容"),
    commentId: z.number().optional().describe("回复目标评论 ID，用于回复评论")
  })
});

export const AgentToolCommentLike = MainAgentTool.createRendererTool({
  name: "agent-tool-comment-like",
  description: "点赞或取消点赞评论，需要登录",
  risk: McpToolRisk.Destructive,
  timeoutMs: 30000,
  inputSchema: z.object({
    cid: z.number().describe("评论 ID"),
    id: z.number().describe("资源 ID"),
    type: z.enum(["track", "album", "playlist"]).describe("资源类型"),
    like: z.boolean().describe("true 点赞，false 取消点赞")
  })
});

export const AgentToolSearchHot = MainAgentTool.createRendererTool({
  name: "agent-tool-search-hot",
  description: "获取当前热搜关键词列表",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object()
});

export const AgentToolSearchSuggest = MainAgentTool.createRendererTool({
  name: "agent-tool-search-suggest",
  description: "获取搜索建议，输入部分关键词即可获得补全建议",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    keyword: z.string().min(1).describe("搜索关键词")
  })
});

export const AgentToolHomeToplists = MainAgentTool.createRendererTool({
  name: "agent-tool-home-toplists",
  description: "获取所有官方音乐排行榜和榜单",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object()
});

export const AgentToolSettingsGet = MainAgentTool.createRendererTool({
  name: "agent-tool-settings-get",
  description: "获取当前应用的设置信息",
  risk: McpToolRisk.Read,
  timeoutMs: 5000,
  inputSchema: z.object()
});

export const AgentToolRecord = MainAgentTool.createRendererTool({
  name: "agent-tool-record",
  description: "获取听歌统计数据，支持今日、总计、本周、本月。需要登录",
  risk: McpToolRisk.Read,
  timeoutMs: 20000,
  inputSchema: z.object({
    type: z
      .enum(["today", "total", "week", "month"])
      .describe("统计类型：today 今日，total 总计，week 本周，month 本月")
  })
});

export const rendererTools: readonly McpTool[] = [
  AgentToolTrackDetail,
  AgentToolTrackPlayable,
  AgentToolTrackLyrics,
  AgentToolTrackSimilar,
  AgentToolTrackPlay,
  AgentToolComment,
  AgentToolAlbumDetail,
  AgentToolArtistDetail,
  AgentToolPlaylistDetail,
  AgentToolPlayerAction,
  AgentToolChangeSettings,
  AgentToolSearch,
  AgentToolLyricSchema,
  AgentToolReplaceLyrics,
  AgentToolSourceOpen,
  AgentToolCommentOpen,
  AgentToolSearchOpen,
  AgentToolPlayerCurrent,
  AgentToolPlayerVolume,
  AgentToolPlayerSeek,
  AgentToolPlayerMode,
  AgentToolPlayerQueue,
  AgentToolPlayerQueueAdd,
  AgentToolPlayerQueueRemove,
  AgentToolUserInfo,
  AgentToolUserPlaylists,
  AgentToolUserPlayHistory,
  AgentToolTrackRecommendDaily,
  AgentToolTrackRecommendNew,
  AgentToolTrackFM,
  AgentToolFMTrash,
  AgentToolTrackLike,
  AgentToolArtistHotTracks,
  AgentToolArtistAlbums,
  AgentToolArtistSimilar,
  AgentToolArtistToplist,
  AgentToolArtistDesc,
  AgentToolPlaylistRecommend,
  AgentToolPlaylistCreate,
  AgentToolPlaylistDelete,
  AgentToolPlaylistModify,
  AgentToolPlaylistStar,
  AgentToolPlaylistSimilar,
  AgentToolPlaylistTop,
  AgentToolAlbumNew,
  AgentToolAlbumStar,
  AgentToolCommentSend,
  AgentToolCommentLike,
  AgentToolSearchHot,
  AgentToolSearchSuggest,
  AgentToolHomeToplists,
  AgentToolSettingsGet,
  AgentToolRecord
];
