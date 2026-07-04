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
  readonly description = "获取指定 ID 的歌曲详情";

  inputSchema = z.object({
    id: z.number().describe("歌曲 ID")
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

export class AgentToolComment {
  readonly name = "agent-tool-track-comment";
  readonly description = "获取指定 ID 的歌曲评论";

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
