import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { AIAgent, LLMProviderOpenAI } from "@mahiru/ai";
import { MainStoreForConfig } from "@/lib/key-value-store";

import { ConversationStore, ProviderAPIKeyStore, ProviderConfigStore } from "./store";
import {
  AgentContextSettings,
  AgentContextCurrentTrackMeta,
  AgentContextCurrentFocusContext
} from "./source";
import {
  AgentToolRecord,
  AgentToolSearch,
  AgentToolComment,
  AgentToolFMTrash,
  AgentToolTrackFM,
  AgentToolAlbumNew,
  AgentToolUserInfo,
  AgentToolAlbumStar,
  AgentToolSearchHot,
  AgentToolTrackLike,
  AgentToolTrackPlay,
  AgentToolArtistDesc,
  AgentToolPlayerSeek,
  AgentToolSearchOpen,
  AgentToolSourceOpen,
  AgentToolAlbumDetail,
  AgentToolCommentLike,
  AgentToolCommentOpen,
  AgentToolCommentSend,
  AgentToolLyricSchema,
  AgentToolPlayerQueue,
  AgentToolPlaylistTop,
  AgentToolSettingsGet,
  AgentToolTrackDetail,
  AgentToolTrackLyrics,
  AgentToolArtistAlbums,
  AgentToolArtistDetail,
  AgentToolHomeToplists,
  AgentToolPlayerAction,
  AgentToolPlayerVolume,
  AgentToolPlaylistStar,
  AgentToolTrackSimilar,
  AgentToolArtistSimilar,
  AgentToolArtistToplist,
  AgentToolPlayerCurrent,
  AgentToolReplaceLyrics,
  AgentToolSearchSuggest,
  AgentToolTrackPlayable,
  AgentToolUserPlaylists,
  AgentToolChangeSettings,
  AgentToolPlaylistCreate,
  AgentToolPlaylistDelete,
  AgentToolPlaylistDetail,
  AgentToolPlaylistModify,
  AgentToolArtistHotTracks,
  AgentToolPlaylistSimilar,
  AgentToolUserPlayHistory,
  AgentToolPlaylistRecommend,
  AgentToolTrackRecommendNew,
  AgentToolTrackRecommendDaily
} from "./tools";

export class MainAgent {
  private static agent?: AIAgent;

  static init() {
    if (this.agent) return this.agent;

    this.agent = new AIAgent({
      inject: {
        Log,
        CreateID: () => crypto.randomUUID(),
        ConversationStore: new ConversationStore(),
        ProviderAPIKeyStore: new ProviderAPIKeyStore(),
        ProviderConfigStore: new ProviderConfigStore()
      },
      systemPrompt: `
  你是 AiraMusic 内置的智能音乐助手。你的任务是结合会话上下文、当前应用状态和可用工具，帮助用户查找音乐信息、发现歌曲，并直接操作 AiraMusic。

  ## 核心能力

  你可以通过工具完成以下任务：

  1. 搜索歌曲、歌单、专辑和艺术家。
  2. 获取歌曲、歌单、专辑和艺术家的详细信息。
  3. 检查歌曲是否具有播放权限。
  4. 获取歌曲歌词、相似歌曲和资源评论。
  5. 播放指定歌曲，或控制当前播放器（播放、暂停、切歌、音量、进度、播放队列）。
  6. 获取当前播放器状态（当前曲目、进度、音量、播放模式）。
  7. 查看和管理歌单（创建、删除、添加/移除歌曲、收藏/取消收藏、推荐歌单）。
  8. 查看和管理专辑（最新专辑、收藏/取消收藏）。
  9. 获取艺人相关信息（热门歌曲、专辑列表、相似艺人、艺人描述、歌手排行榜）。
  10. 获取用户信息、用户歌单、播放历史。
  11. 喜欢/取消喜欢歌曲。
  12. 获取每日推荐歌曲、新歌速递、私人 FM、推荐歌单、排行榜。
  13. 发表评论和点赞评论。
  14. 获取热搜关键词和搜索建议。
  15. 打开歌单、专辑、艺术家、评论或搜索界面。
  16. 获取当前歌词的数据结构，并替换歌词的翻译或罗马音。
  17. 读取和修改应用设置。
  18. 获取听歌统计数据（今日、总计、本周、本月）。
  19. 搜索公开网页，获取近期新闻、官网资料、外部文档或互联网事实。

  ## 工具使用原则

  - 用户要求查询实时的歌曲、歌手、专辑、歌单、歌词、评论、版权状态或应用状态时，优先调用工具，不要依赖记忆猜测。
  - 不得编造歌曲 ID、资源 ID、搜索结果、播放状态、评论内容、歌词内容、设置键或工具执行结果。
  - 只有工具明确返回成功后，才能声称已经完成播放、暂停、跳转、修改设置、替换歌词或打开页面等操作。
  - 工具失败、超时或返回数据不足时，应简要说明实际情况；可以调整参数重试一次，但不要无休止重复调用。
  - 能通过一次工具调用完成的任务，不要拆成多次重复调用。
  - 涉及需要登录的操作（如用户信息、播放历史、收藏、评论、创建歌单等）时，如果工具返回未登录错误，应提示用户先登录。
  - 破坏性操作（删除歌单、修改歌单内容、取消收藏、修改设置、发送评论等）在执行前应简要确认意图；如果用户请求模糊，先问清楚再执行。
  - 如果某个破坏性工具当前不可用（配置未启用），应说明该功能需要开启后才能使用，不要假装已执行。

  ## 网页搜索

  - 用户询问近期新闻、最新资料、官网说明、外部项目、文档、互联网事实或 AiraMusic 当前工具无法覆盖的信息时，可以使用网页搜索。
  - 网页搜索只读取公开网页，不代表用户账号内的私有数据，也不能替代 AiraMusic 内部音乐搜索工具。
  - 查询歌曲、歌手、专辑、歌单、歌词、评论或播放权限时，仍优先使用 AiraMusic 音乐工具；只有需要外部网页资料时才使用网页搜索。
  - 使用网页搜索结果回答时，应基于返回的 title、snippet 和 URL；不要把未出现在搜索结果里的内容当作事实。
  - 涉及网页事实、新闻或文档时，应在回答中给出来源 URL，方便用户核对。

  ## 搜索与资源查询

  - 用户只提供名称而没有资源 ID 时，先使用搜索工具获取候选资源。
  - 搜索关键字应保留用户给出的歌名、艺术家名、专辑名等核心信息，不要擅自加入过多限制。
  - 搜索结果存在同名或明显歧义时，应结合艺术家、专辑等信息判断；仍无法判断时，再让用户选择。
  - 需要获取多首歌曲详情时，应把已知歌曲 ID 尽可能合并到一次歌曲详情请求中，避免逐首请求。
  - 只需要名称、艺术家、专辑等基础信息时，使用简单详情模式；确实需要完整信息时才使用详细模式。
  - 推荐歌曲时，应优先基于搜索结果、相似歌曲、歌单内容、每日推荐或会话中明确表达的偏好，不要把模型记忆中的歌曲当作已验证结果。
  - 用户要求播放某首歌时，通常按以下顺序处理：
    1. 确定歌曲 ID；
    2. 必要时检查是否可播放；
    3. 调用歌曲播放工具；
    4. 根据真实结果回复。
  - 用户只是要求查看资源时，打开对应页面，不要自动播放。
  - 用户只是要求搜索并查看更多结果时，可以打开搜索页面，不必把全部结果逐项输出。

  ## 播放器操作

  - 用户明确要求播放、暂停、上一首、下一首或退出播放时，可以直接执行相应操作。
  - 调节音量时，数值范围为 0-100。
  - 跳转播放进度时，可以传入秒数或百分比（如 "50%" 表示歌曲中点）。
  - 获取当前播放信息时，会返回曲目详情、播放进度、音量、循环模式和随机模式。
  - 不要声称支持工具列表中不存在的播放器操作。

  ## 歌单与收藏管理

  - 创建、删除歌单和修改歌单内容属于破坏性操作，需要用户明确确认后才能执行。
  - 这些破坏性工具可能因配置未启用而不可用；如果不可用，应如实告知用户并建议其开启相关设置。
  - 向歌单添加或删除歌曲需要歌单 ID 和歌曲 ID 列表。
  - 收藏/取消收藏歌单和专辑使用不同的工具，注意区分。
  - 获取用户自己的歌单列表时，不传 uid 则默认为当前登录用户。
  - 喜欢/取消喜欢歌曲、收藏/取消收藏歌单与专辑、发送评论、修改设置也属于破坏性操作，同样需要确认。

  ## 评论操作

  - 获取评论和发送评论是不同操作：
    - 用户询问评论内容时，获取评论数据；
    - 用户要求发表评论或删除评论时，使用对应的评论工具（需确认）。
  - 获取评论和打开评论页面也是不同操作，根据用户意图选择。
  - 评论排序规则：
    - "热门评论"使用 hot；
    - "最新评论"使用 new；
    - 没有明确要求时优先使用 recommend 或 hot。
  - 没有明确页码时，从第 1 页开始；除非确有必要，不要一次请求过多评论。

  ## 发现与推荐

  - 用户想发现新音乐时，可以推荐每日推荐歌曲、新歌速递、私人 FM、推荐歌单或排行榜。
  - 每日推荐歌曲和私人 FM 需要登录。
  - 新歌速递可按地区筛选：华语(7)、欧美(96)、日本(8)、韩国(16)，默认全部(0)。
  - 热搜关键词可帮助用户了解当前流行趋势。
  - 搜索建议适合在用户输入不完整时提供补全。

  ## 艺人信息

  - 获取艺人热门 50 首歌曲可快速了解其代表作。
  - 获取艺人专辑列表可查看其全部作品。
  - 相似艺人可帮助用户发现风格相近的音乐人。
  - 歌手排行榜可按地区筛选。

  ## 歌词处理

  - 用户询问歌词内容时，使用歌曲歌词工具。
  - 用户要求修改当前歌词的翻译或罗马音时，必须先获取当前歌词 JSON Schema 或数据结构。
  - 替换歌词时，应严格遵守工具返回的数据结构，输出有效的 JSON 字符串，不要添加 Markdown 代码围栏、解释文字或额外包装。
  - 只修改用户要求的翻译或罗马音字段，尽量保留原歌词的时间轴、原文、顺序和其他已有数据。
  - 当前播放歌曲不明确、歌词结构获取失败或生成结果无法满足结构要求时，不要执行替换。

  ## 设置修改

  - 只有设置键名和合法值能够从上下文中明确确定时，才调用设置修改工具。
  - 不确定当前设置值时，可先使用获取设置工具查看。
  - 不要根据自然语言自行猜测内部设置键。
  - 设置项含义、键名或值类型不明确时，应说明当前缺少必要信息，而不是尝试随机键值。
  - 修改成功后说明具体修改了什么；修改失败时不要声称设置已经生效。

  ## 回答要求

  - 默认使用与用户相同的语言回答。
  - 回答应自然、简洁、直接，优先给出查询或操作结果。
  - 不要向用户展示工具名称、内部参数、调用协议、资源请求流程或内部实现细节。
  - 不要无意义地复述用户的问题，也不要逐步汇报每一次工具调用。
  - 如果找到了多个合理候选，可以列出少量最相关结果，并提供足以区分它们的信息。
  - 如果用户的请求无法由当前工具完成，应明确说明能力边界，不要假装已经完成。
  - 不要因为缺少非必要信息而频繁追问；可以可靠判断时直接执行。
  - 涉及可能明显改变用户当前状态的操作时，以用户的明确意图为准，不要擅自扩展操作范围。
  - emoji使用要克制，不要过度使用，除非用户要求。
  - 在介绍任何歌曲时，可以先获取歌曲信息、歌手信息、专辑信息、专辑评论、歌曲评论等，充分了解后再介绍而不是编造答案。
      `,
      titlePrompt: `
  根据用户的第一条消息生成一个简洁、准确的中文会话标题。
  要求：
  - 概括用户的核心意图、目标或音乐主题；
  - 不超过 20 个中文字符；
  - 优先保留歌曲名、歌手名、专辑名或功能名称等关键信息；
  - 不使用"关于""咨询""问题""请求"等空泛前缀；
  - 不添加引号、书名号、句号、冒号、表情或 Markdown；
  - 不回答用户的问题；
  - 只输出标题本身。
  示例：
  用户：帮我播放周杰伦的晴天
  标题：播放周杰伦晴天

  用户：找一些和春日影相似的歌
  标题：寻找春日影相似歌曲

  用户：这首歌的歌词是什么意思
  标题：解析当前歌曲歌词

  用户：打开这个歌单的评论
  标题：查看歌单评论
      `,
      titleMaxOutputTokens: 25,
      maxSteps: 30,
      tools: {
        strict: true,
        choice: "auto",
        list: (() => {
          const enableDestructive = MainStoreForConfig.get("enableDestructiveTools", false);

          const safe = [
            new AgentToolSearch(),
            new AgentToolComment(),
            new AgentToolTrackDetail(),
            new AgentToolAlbumDetail(),
            new AgentToolArtistDetail(),
            new AgentToolPlayerAction(),
            new AgentToolTrackLyrics(),
            new AgentToolTrackSimilar(),
            new AgentToolTrackPlayable(),
            new AgentToolPlaylistDetail(),
            new AgentToolTrackPlay(),
            new AgentToolReplaceLyrics(),
            new AgentToolLyricSchema(),
            new AgentToolSourceOpen(),
            new AgentToolSearchOpen(),
            new AgentToolCommentOpen(),
            new AgentToolPlayerCurrent(),
            new AgentToolPlayerVolume(),
            new AgentToolPlayerSeek(),
            new AgentToolPlayerQueue(),
            new AgentToolUserInfo(),
            new AgentToolUserPlaylists(),
            new AgentToolUserPlayHistory(),
            new AgentToolTrackRecommendDaily(),
            new AgentToolTrackRecommendNew(),
            new AgentToolTrackFM(),
            new AgentToolArtistHotTracks(),
            new AgentToolArtistAlbums(),
            new AgentToolArtistSimilar(),
            new AgentToolArtistToplist(),
            new AgentToolArtistDesc(),
            new AgentToolPlaylistRecommend(),
            new AgentToolPlaylistSimilar(),
            new AgentToolPlaylistTop(),
            new AgentToolAlbumNew(),
            new AgentToolSearchHot(),
            new AgentToolSearchSuggest(),
            new AgentToolHomeToplists(),
            new AgentToolSettingsGet(),
            new AgentToolRecord()
          ];

          const destructive = [
            new AgentToolChangeSettings(),
            new AgentToolTrackLike(),
            new AgentToolFMTrash(),
            new AgentToolPlaylistCreate(),
            new AgentToolPlaylistDelete(),
            new AgentToolPlaylistModify(),
            new AgentToolPlaylistStar(),
            new AgentToolAlbumStar(),
            new AgentToolCommentSend(),
            new AgentToolCommentLike()
          ];

          return enableDestructive ? [...safe, ...destructive] : safe;
        })()
      },
      providers: [new LLMProviderOpenAI()],
      context: {
        maxChars: 10_000,
        defaultRole: "system",
        sources: [
          new AgentContextCurrentTrackMeta(),
          new AgentContextCurrentFocusContext(),
          new AgentContextSettings()
        ]
      }
    });
    this.agent.listen((event) => {
      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "agent",
        type: "message_deliver_agent_chat_event",
        data: event
      });
    });

    return this.agent;
  }

  private static current() {
    return this.agent ?? this.init();
  }

  static listProviders() {
    return this.current().listProviders();
  }

  static listConfigs() {
    return this.current().listConfigs();
  }

  static createConfig(options: Parameters<AIAgent["createConfig"]>[0]) {
    return this.current().createConfig(options);
  }

  static createConversation(options?: Parameters<AIAgent["createConversation"]>[0]) {
    return this.current().createConversation(options);
  }

  static listConversations() {
    return this.current().listConversations();
  }

  static listRuns() {
    return this.current().listRuns();
  }

  static getConversationSnapshot(id: string) {
    return this.current().getConversationSnapshot(id);
  }

  static removeConversation(id: string) {
    return this.current().removeConversation(id);
  }

  static chat(options: Parameters<AIAgent["chat"]>[0]) {
    return this.current().chat(options);
  }

  static abort(runID: string) {
    return this.current().abort(runID);
  }
}
