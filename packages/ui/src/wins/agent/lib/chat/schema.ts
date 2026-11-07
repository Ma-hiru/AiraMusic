import { z } from "zod";
import type { AGUIEvent } from "@mahiru/agent/browser";

const identity = z.object({ threadId: z.string(), runId: z.string() });
const message = identity.extend({ messageId: z.string() });
const tool = identity.extend({ toolCallId: z.string() });
const tokenCount = z.number().int().nonnegative();
const requestUsageTotals = z.object({
  requests: tokenCount,
  reportedRequests: tokenCount,
  promptTokens: tokenCount,
  completionTokens: tokenCount
});
const auxiliaryUsage = z.object({ title: requestUsageTotals, compaction: requestUsageTotals });
const usages = z.object({
  requests: tokenCount.nullish(),
  last_step: tokenCount.nullish(),
  records: z.array(
    z.object({
      step: tokenCount,
      usage: z.object({
        prompt_tokens: tokenCount,
        completion_tokens: tokenCount,
        total_tokens: tokenCount.nullish(),
        cached_tokens: tokenCount.nullish(),
        cache_write_tokens: tokenCount.nullish(),
        reasoning_tokens: tokenCount.nullish()
      })
    })
  )
});

/** Rust 生成类型负责静态契约，事件入口负责校验实际收到的数据。 */
export const agentEventSchema = z.discriminatedUnion("type", [
  identity.extend({
    type: z.literal("CUSTOM"),
    name: z.string(),
    value: z.object({
      name: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
      auxiliaryUsage: auxiliaryUsage.nullish()
    })
  }),
  identity.extend({ type: z.literal("RUN_STARTED") }),
  identity.extend({
    type: z.literal("RUN_FINISHED"),
    result: z.string().nullable(),
    usages
  }),
  identity.extend({
    type: z.literal("RUN_ERROR"),
    message: z.string(),
    usages: usages.nullable()
  }),
  identity.extend({ type: z.literal("STEP_STARTED"), stepName: z.string() }),
  identity.extend({ type: z.literal("STEP_FINISHED"), stepName: z.string() }),
  message.extend({
    type: z.literal("TEXT_MESSAGE_START"),
    role: z.enum(["system", "user", "assistant", "tool", "inner"])
  }),
  message.extend({ type: z.literal("TEXT_MESSAGE_CONTENT"), delta: z.string() }),
  message.extend({ type: z.literal("TEXT_MESSAGE_END") }),
  message.extend({ type: z.literal("REASONING_MESSAGE_START"), role: z.literal("reasoning") }),
  message.extend({ type: z.literal("REASONING_MESSAGE_CONTENT"), delta: z.string() }),
  message.extend({ type: z.literal("REASONING_MESSAGE_END") }),
  tool.extend({ type: z.literal("TOOL_CALL_START"), toolCallName: z.string() }),
  tool.extend({ type: z.literal("TOOL_CALL_ARGS"), delta: z.string() }),
  tool.extend({ type: z.literal("TOOL_CALL_END") }),
  tool.extend({ type: z.literal("TOOL_CALL_RESULT"), messageId: z.string(), content: z.string() })
]) satisfies z.ZodType<AGUIEvent>;
