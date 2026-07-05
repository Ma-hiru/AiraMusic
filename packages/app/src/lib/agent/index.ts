import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { AIAgent, LLMProviderOpenAI } from "@mahiru/ai";
import { ConversationStore, ProviderAPIKeyStore, ProviderConfigStore } from "@/lib/agent/store";
import {
  AgentContextSettings,
  AgentContextCurrentTrackMeta,
  AgentContextCurrentFocusContext
} from "@/lib/agent/source";
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
} from "@/lib/agent/tools";

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
      systemPrompt:
        "你是 AiraMusic 的音乐助手，通过获取上下文和执行工具来帮助用户操作程序和发现心仪的歌曲",
      titlePrompt: "把用户第一句话总结成 15 个字以内的会话标题，只输出标题",
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
