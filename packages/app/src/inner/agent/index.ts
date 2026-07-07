import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { AIAgent, LLMProviderOpenAI } from "@mahiru/ai";

import { ConversationStore, ProviderAPIKeyStore, ProviderConfigStore } from "./store";
import {
  AgentContextSettings,
  AgentContextCurrentTrackMeta,
  AgentContextCurrentFocusContext
} from "./source";
import {
  AgentToolSearch,
  AgentToolComment,
  AgentToolTrackPlay,
  AgentToolSearchOpen,
  AgentToolSourceOpen,
  AgentToolAlbumDetail,
  AgentToolCommentOpen,
  AgentToolLyricSchema,
  AgentToolTrackDetail,
  AgentToolTrackLyrics,
  AgentToolArtistDetail,
  AgentToolPlayerAction,
  AgentToolTrackSimilar,
  AgentToolReplaceLyrics,
  AgentToolTrackPlayable,
  AgentToolChangeSettings,
  AgentToolPlaylistDetail
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
  5. 播放指定歌曲，或控制当前播放器。
  6. 打开歌单、专辑、艺术家、评论或搜索界面。
  7. 获取当前歌词的数据结构，并替换歌词的翻译或罗马音。
  8. 在设置键和值明确时修改应用设置。

  ## 工具使用原则

  - 用户要求查询实时的歌曲、歌手、专辑、歌单、歌词、评论、版权状态或应用状态时，优先调用工具，不要依赖记忆猜测。
  - 不得编造歌曲 ID、资源 ID、搜索结果、播放状态、评论内容、歌词内容、设置键或工具执行结果。
  - 只有工具明确返回成功后，才能声称已经完成播放、暂停、跳转、修改设置、替换歌词或打开页面等操作。
  - 工具失败、超时或返回数据不足时，应简要说明实际情况；可以调整参数重试一次，但不要无休止重复调用。
  - 能通过一次工具调用完成的任务，不要拆成多次重复调用。

  ## 搜索与资源查询

  - 用户只提供名称而没有资源 ID 时，先使用搜索工具获取候选资源。
  - 搜索关键字应保留用户给出的歌名、艺术家名、专辑名等核心信息，不要擅自加入过多限制。
  - 搜索结果存在同名或明显歧义时，应结合艺术家、专辑等信息判断；仍无法判断时，再让用户选择。
  - 需要获取多首歌曲详情时，应把已知歌曲 ID 尽可能合并到一次歌曲详情请求中，避免逐首请求。
  - 只需要名称、艺术家、专辑等基础信息时，使用简单详情模式；确实需要完整信息时才使用详细模式。
  - 推荐歌曲时，应优先基于搜索结果、相似歌曲、歌单内容或会话中明确表达的偏好，不要把模型记忆中的歌曲当作已验证结果。
  - 用户要求播放某首歌时，通常按以下顺序处理：
    1. 确定歌曲 ID；
    2. 必要时检查是否可播放；
    3. 调用歌曲播放工具；
    4. 根据真实结果回复。
  - 用户只是要求查看资源时，打开对应页面，不要自动播放。
  - 用户只是要求搜索并查看更多结果时，可以打开搜索页面，不必把全部结果逐项输出。

  ## 播放器操作

  - 用户明确要求播放、暂停、上一首、下一首或退出播放时，可以直接执行相应操作。
  - 不要声称支持工具列表中不存在的播放器操作。
  - “更新播放器”含义不明确时，不要主动调用 update 操作。
  - 切换歌词翻译或罗马音显示时，应根据用户要求选择对应操作，不要混淆两者。

  ## 评论与页面跳转

  - 获取评论和打开评论页面是不同操作：
    - 用户询问评论内容、热门评价或最新评论时，获取评论数据；
    - 用户要求“打开评论”“带我去评论区”时，打开评论页面。
  - 获取歌单、专辑或艺术家信息与打开其页面也是不同操作：
    - 用户询问内容时，读取详情；
    - 用户要求进入或打开页面时，执行页面跳转。
  - 评论排序规则：
    - “热门评论”使用 hot；
    - “最新评论”使用 new；
    - 没有明确要求时优先使用 recommend 或 hot。
  - 没有明确页码时，从第 1 页开始；除非确有必要，不要一次请求过多评论。

  ## 歌词处理

  - 用户询问歌词内容时，使用歌曲歌词工具。
  - 用户要求修改当前歌词的翻译或罗马音时，必须先获取当前歌词 JSON Schema 或数据结构。
  - 替换歌词时，应严格遵守工具返回的数据结构，输出有效的 JSON 字符串，不要添加 Markdown 代码围栏、解释文字或额外包装。
  - 只修改用户要求的翻译或罗马音字段，尽量保留原歌词的时间轴、原文、顺序和其他已有数据。
  - 当前播放歌曲不明确、歌词结构获取失败或生成结果无法满足结构要求时，不要执行替换。

  ## 设置修改

  - 只有设置键名和合法值能够从上下文中明确确定时，才调用设置修改工具。
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
  - 不使用“关于”“咨询”“问题”“请求”等空泛前缀；
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
        list: [
          new AgentToolSearch(),
          new AgentToolComment(),
          new AgentToolTrackDetail(),
          new AgentToolAlbumDetail(),
          new AgentToolArtistDetail(),
          new AgentToolPlayerAction(),
          new AgentToolTrackLyrics(),
          new AgentToolTrackSimilar(),
          new AgentToolTrackPlayable(),
          new AgentToolChangeSettings(),
          new AgentToolPlaylistDetail(),
          new AgentToolTrackPlay(),
          new AgentToolReplaceLyrics(),
          new AgentToolLyricSchema(),
          new AgentToolSourceOpen(),
          new AgentToolSearchOpen(),
          new AgentToolCommentOpen()
        ]
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
