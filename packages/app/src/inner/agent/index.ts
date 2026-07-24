import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainStoreForConfig } from "@/lib/key-value-store";
import {
  AIAgent,
  AIError,
  LLMProviderOpenAI,
  AiraRichContentPrompt,
  LLMDefaultContextWindowTokens
} from "@mahiru/ai";

import { createAiraAgentSkills } from "./skills";
import { sanitizeAiraRichContent } from "./rich-content";
import { createAgentToolCatalog, buildAgentToolRoutingText } from "./tool-catalog";
import { ConversationStore, ProviderAPIKeyStore, ProviderConfigStore } from "./store";
import {
  AgentDynamicContextMaxChars,
  AgentContextCurrentTrackMeta,
  AgentContextCurrentFocusContext
} from "./source";

export class MainAgent {
  private static agent?: AIAgent;

  static isEnabled() {
    return MainStoreForConfig.get("enableAgent", true);
  }

  static init() {
    if (!this.isEnabled()) {
      throw new AIError({
        type: "invalid_config",
        message: "Agent 已在设置中关闭"
      });
    }
    if (this.agent) return this.agent;

    const toolCatalog = createAgentToolCatalog(
      MainStoreForConfig.get("enableDestructiveTools", false)
    );

    this.agent = new AIAgent({
      inject: {
        Log,
        CreateID: () => crypto.randomUUID(),
        ConversationStore: new ConversationStore(),
        ProviderAPIKeyStore: new ProviderAPIKeyStore(),
        ProviderConfigStore: new ProviderConfigStore()
      },
      systemPrompt: `
你是 AiraMusic 内置的智能音乐助手。结合会话、当前应用状态、激活的 Skill 和可用工具，帮助用户理解、发现与操作音乐。

工具定义就是本轮真实能力边界。当前曲目和焦点上下文可能随请求变化；把它们用于解析“这首歌”“这个专辑”等指代，但不要把动态上下文写入长期事实。
遵循随后提供的 agent_rule；只有与当前意图匹配的 active_skill 才是本轮工作流。多个 Skill 同时激活时合并执行，复用已经取得的资源 ID 和结果，避免重复请求。
歌曲介绍、作品背景和跨媒体剧情/情绪解释必须完成对应 active_skill 的网页取证步骤后再回答；播放控制、当前状态和纯本地操作不因此联网。

${AiraRichContentPrompt}
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
      titleMaxOutputTokens: 128,
      transformFinalText: ({ text, messages }) => sanitizeAiraRichContent(text, messages),
      // 常规取证流程约需 3～6 步；限制异常循环，避免同一前缀和工具结果被反复计费。
      maxSteps: 12,
      history: {
        defaultContextWindowTokens: LLMDefaultContextWindowTokens,
        defaultMaxOutputTokens: 4_096,
        // 百万级物理窗口留给单轮大任务；日常历史按软工作集提前摘要，避免每步重复重放。
        maxWorkingSetTokens: 64_000,
        keepRecentTurns: 6,
        minRecentTurns: 2,
        triggerRatio: 0.8,
        targetRatio: 0.65,
        fallback: "window_only"
      },
      skills: {
        list: createAiraAgentSkills()
      },
      resolveIntent: ({ input, conversation }) => buildAgentToolRoutingText(input, conversation),
      tools: {
        strict: true,
        choice: "auto",
        maxOutputChars: 32_000,
        maxTotalOutputChars: 40_000,
        list: toolCatalog.list,
        parallelSafeNames: toolCatalog.parallelSafeNames,
        // 当前目录已把所有写操作排除在 parallelSafeNames 外，先保守复用为可重试集合。
        retrySafeNames: toolCatalog.parallelSafeNames,
        select: ({ input, rawInput }) => toolCatalog.select(input, rawInput)
      },
      providers: [new LLMProviderOpenAI()],
      context: {
        // 动态页面信息每个模型步骤都会重放；6K 足够容纳当前资源，又避免历史页拖高整轮输入。
        maxChars: AgentDynamicContextMaxChars,
        defaultRole: "user",
        placement: "before_user",
        sources: [new AgentContextCurrentTrackMeta(), new AgentContextCurrentFocusContext()]
      }
    });
    this.agent.listen((event, sequence) => {
      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "agent",
        type: "message_deliver_agent_chat_event",
        data: { sequence, event }
      });
    });

    return this.agent;
  }

  private static current() {
    if (!this.isEnabled()) {
      throw new AIError({
        type: "invalid_config",
        message: "Agent 已在设置中关闭"
      });
    }
    return this.agent ?? this.init();
  }

  static listProviders() {
    return this.current().listProviders();
  }

  static listProviderDescriptors() {
    return this.current().listProviderDescriptors();
  }

  static listConfigs() {
    return this.current().listConfigs();
  }

  static createConfig(options: Parameters<AIAgent["createConfig"]>[0]) {
    return this.current().createConfig(options);
  }

  static updateConfig(options: Parameters<AIAgent["updateConfig"]>[0]) {
    return this.current().updateConfig(options);
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
