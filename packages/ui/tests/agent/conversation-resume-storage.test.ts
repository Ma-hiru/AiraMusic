import {
  normalizeAgentStorageSnapshot,
  getAgentRecoverableConversationIDs,
  AGENT_PENDING_MESSAGE_STORAGE_LIMIT
} from "@mahiru/ui/wins/agent/atoms/agent";

describe("Agent 会话恢复存储", () => {
  it("把旧版完整会话快照迁移为轻量恢复字段", () => {
    const pendingUserMessage = "待恢复消息".repeat(1_000);
    const snapshot = normalizeAgentStorageSnapshot({
      selectedConfigID: "config-1",
      selectedConversationID: "conversation-1",
      conversationResumeStates: {
        "conversation-1": {
          recovering: true,
          runningRunID: "run-1",
          pendingUserMessage,
          conversation: {
            id: "conversation-1",
            name: "旧版快照",
            messages: [{ role: "user", content: "不应保存在 renderer 恢复状态中" }],
            assistantTurns: [{ runID: "run-1", steps: [{ type: "tool-result", output: "很大" }] }]
          }
        }
      }
    });

    expect(snapshot.conversationResumeStates["conversation-1"]).toEqual({
      conversationID: "conversation-1",
      recovering: true,
      runningRunID: "run-1",
      pendingUserMessage: pendingUserMessage.slice(0, AGENT_PENDING_MESSAGE_STORAGE_LIMIT)
    });
    expect(snapshot.conversationResumeStates["conversation-1"]).not.toHaveProperty("conversation");
  });

  it("丢弃损坏和空闲的旧记录，并把待发送消息纳入恢复", () => {
    const snapshot = normalizeAgentStorageSnapshot({
      selectedConfigID: 42,
      selectedConversationID: null,
      conversationResumeStates: {
        idle: {
          recovering: false,
          runningRunID: "",
          pendingUserMessage: ""
        },
        pending: {
          recovering: false,
          runningRunID: "",
          pendingUserMessage: "等待主进程确认"
        },
        broken: "invalid"
      }
    });

    expect(snapshot.selectedConfigID).toBe("");
    expect(snapshot.selectedConversationID).toBe("");
    expect(snapshot.conversationResumeStates).toEqual({
      pending: {
        conversationID: "pending",
        recovering: false,
        runningRunID: "",
        pendingUserMessage: "等待主进程确认"
      }
    });
    expect(getAgentRecoverableConversationIDs(snapshot.conversationResumeStates)).toEqual([
      "pending"
    ]);
  });
});
