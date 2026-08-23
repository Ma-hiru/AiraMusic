import {
  formatTokenCount,
  getUncachedInputTokens,
  parseAgentTurnUsage,
  toTerminalError
} from "@mahiru/ui/wins/agent/page/chat/observability";

describe("Agent 可观测信息格式化", () => {
  it("格式化 token 数量并计算未缓存输入", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1_500)).toBe("1.5K");
    expect(formatTokenCount(2_000_000)).toBe("2M");
    expect(getUncachedInputTokens({ input: 120, cachedInput: 80 })).toBe(40);
  });

  it("读取 Rust 服务错误", () => {
    expect(toTerminalError({ code: "run_failed", message: "模型请求失败" })).toBe(
      "run_failed: 模型请求失败"
    );
    expect(toTerminalError("已取消")).toBe("已取消");
  });

  it("汇总 Rust TurnUsage 的多个 step", () => {
    expect(
      parseAgentTurnUsage({
        records: [
          { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } },
          { step: 2, usage: { prompt_tokens: 120, completion_tokens: 10 } }
        ]
      })
    ).toEqual({
      step: 2,
      usage: {
        input: 220,
        output: 30,
        total: 250,
        requests: 2,
        lastInput: 120
      }
    });
  });

  it("忽略空或损坏的 Rust TurnUsage", () => {
    expect(parseAgentTurnUsage({ records: [] })).toBeUndefined();
    expect(
      parseAgentTurnUsage({
        records: [{ step: 1, usage: { prompt_tokens: "100", completion_tokens: 20 } }]
      })
    ).toBeUndefined();
  });
});
