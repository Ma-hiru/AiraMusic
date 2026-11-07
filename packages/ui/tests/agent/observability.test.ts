import {
  toTerminalError,
  formatTokenCount,
  parseAgentTurnUsage,
  getUncachedInputTokens
} from "@mahiru/ui/wins/agent/lib/chat/observability";

describe("Agent 可观测信息格式化", () => {
  it("格式化 token 数量并计算未缓存输入", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1_500)).toBe("1.5K");
    expect(formatTokenCount(2_000_000)).toBe("2M");
    expect(getUncachedInputTokens({ input: 120, cachedInput: 80 })).toBe(40);
    expect(
      getUncachedInputTokens({ input: 120, cachedInput: 80, coverage: "partial" })
    ).toBeUndefined();
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
        requests: 2,
        last_step: 2,
        records: [
          { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20 } },
          { step: 2, usage: { prompt_tokens: 120, completion_tokens: 10 } }
        ]
      })
    ).toMatchObject({
      step: 2,
      usage: {
        input: 220,
        output: 30,
        total: 250,
        requests: 2,
        lastInput: 120,
        reportedRequests: 2,
        coverage: "complete",
        lastInputStatus: "reported"
      }
    });
  });

  it("按最大 step 取末次快照，并累计完整的缓存和思考细分", () => {
    const result = parseAgentTurnUsage({
      requests: 2,
      last_step: 2,
      records: [
        {
          step: 2,
          usage: {
            prompt_tokens: 120,
            completion_tokens: 30,
            total_tokens: 150,
            cached_tokens: 80,
            cache_write_tokens: 20,
            reasoning_tokens: 10
          }
        },
        {
          step: 1,
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            cached_tokens: 50,
            cache_write_tokens: 10,
            reasoning_tokens: 5
          }
        }
      ]
    });
    expect(result).toMatchObject({
      step: 2,
      usage: {
        input: 220,
        output: 50,
        total: 270,
        lastInput: 120,
        cachedInput: 130,
        cacheWrite: 30,
        reasoning: 15
      }
    });
    expect(getUncachedInputTokens(result?.usage)).toBe(90);
  });

  it("末步缺报告时不把上一步输入冒充最新上下文，也不补零用量", () => {
    const result = parseAgentTurnUsage({
      requests: 2,
      last_step: 2,
      records: [
        {
          step: 1,
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            cached_tokens: 80,
            reasoning_tokens: 10
          }
        }
      ]
    });
    expect(result).toMatchObject({
      step: 2,
      usage: {
        input: 100,
        output: 20,
        requests: 2,
        reportedRequests: 1,
        coverage: "partial",
        lastInputStatus: "missing"
      }
    });
    expect(result?.usage?.lastInput).toBeUndefined();
    expect(result?.usage?.cachedInput).toBeUndefined();
    expect(result?.usage?.reasoning).toBeUndefined();
    expect(getUncachedInputTokens(result?.usage)).toBeUndefined();
  });

  it("有末步报告仍标注早先步骤缺失，细分字段缺失不视为零", () => {
    const result = parseAgentTurnUsage({
      requests: 2,
      last_step: 2,
      records: [{ step: 2, usage: { prompt_tokens: 120, completion_tokens: 20 } }]
    });
    expect(result?.usage).toMatchObject({
      lastInput: 120,
      coverage: "partial",
      lastInputStatus: "reported"
    });
    const detailMissing = parseAgentTurnUsage({
      requests: 2,
      last_step: 2,
      records: [
        {
          step: 1,
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            cached_tokens: 80,
            reasoning_tokens: 0
          }
        },
        { step: 2, usage: { prompt_tokens: 120, completion_tokens: 20, reasoning_tokens: 0 } }
      ]
    });
    expect(detailMissing?.usage?.cachedInput).toBeUndefined();
    expect(detailMissing?.usage?.reasoning).toBe(0);
    expect(getUncachedInputTokens(detailMissing?.usage)).toBeUndefined();
  });

  it("旧记录保留已知合计，不能推断实际次数、覆盖范围和末次快照", () => {
    const result = parseAgentTurnUsage({
      records: [
        { step: 1, usage: { prompt_tokens: 100, completion_tokens: 20, cached_tokens: 50 } }
      ]
    });
    expect(result?.usage).toMatchObject({
      input: 100,
      output: 20,
      reportedRequests: 1,
      coverage: "unknown",
      lastInputStatus: "unknown"
    });
    expect(result?.usage?.requests).toBeUndefined();
    expect(result?.usage?.lastInput).toBeUndefined();
    expect(result?.usage?.cachedInput).toBeUndefined();
  });

  it("Rust 可选字段的 null 保持未知，不丢弃有效的用量记录", () => {
    expect(
      parseAgentTurnUsage({
        requests: null,
        last_step: null,
        records: [
          {
            step: 1,
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: null,
              cached_tokens: null
            }
          }
        ]
      })?.usage
    ).toMatchObject({
      input: 100,
      output: 20,
      total: 120,
      coverage: "unknown",
      reportedRequests: 1
    });
  });

  it("区分未发请求和请求全部未报告，不显示伪造的零 Token", () => {
    const none = parseAgentTurnUsage({ records: [], requests: 0 });
    const missing = parseAgentTurnUsage({ records: [], requests: 1, last_step: 1 });
    expect(none?.usage).toMatchObject({
      requests: 0,
      reportedRequests: 0,
      coverage: "complete",
      lastInputStatus: "not_requested"
    });
    expect(missing?.usage).toMatchObject({
      requests: 1,
      reportedRequests: 0,
      coverage: "partial",
      lastInputStatus: "missing"
    });
    expect(none?.usage?.input).toBeUndefined();
    expect(missing?.usage?.input).toBeUndefined();
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
