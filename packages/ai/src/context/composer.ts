import { AIResult } from "@/result";
import { sortResolvedBlocks, formatResolvedBlock, limitResolvedBlocksChars } from "@/utils/context";
import type { LLMMessageText } from "@/provider";

import type {
  LLMContextBlock,
  LLMContextSource,
  LLMContextRuntime,
  LLMContextMessageRole,
  LLMContextBlockResolved,
  LLMContextComposeResult,
  LLMContextSourceFailure,
  LLMContextComposeOptions,
  LLMContextComposerOptions
} from "./interface";

const DefaultMaxChars = 12_000;
const DefaultRole: LLMContextMessageRole = "system";

export class LLMContextComposer {
  private readonly sources = new Map<string, LLMContextSource>();
  private readonly inject: LLMContextComposerOptions["inject"];
  private readonly now: NormalFunc<[], number>;
  private readonly defaultRole: LLMContextMessageRole;
  private readonly defaultMaxChars: number;

  constructor(options: LLMContextComposerOptions) {
    this.inject = options.inject;
    this.now = options.now ?? Date.now;
    this.defaultRole = options.defaultRole ?? DefaultRole;
    this.defaultMaxChars = options.defaultMaxChars ?? DefaultMaxChars;

    for (const source of options.sources ?? []) {
      const registered = this.register(source);
      if (registered.isErr()) throw registered.reason;
    }
  }

  private isExpired(block: LLMContextBlock, now: number) {
    return typeof block.expiresAt === "number" && block.expiresAt <= now;
  }

  private async readSource(
    source: LLMContextSource,
    runtime: LLMContextRuntime
  ): Promise<AIResult<LLMContextBlock[]>> {
    try {
      return await source.load(runtime);
    } catch (error) {
      return AIResult.err({
        type: "context_load",
        message: `context source 加载异常：${source.name}`,
        raw: error
      });
    }
  }

  private normalizeBlock(
    block: LLMContextBlock,
    source: LLMContextSource,
    order: number,
    role?: LLMContextMessageRole
  ): AIResult<LLMContextBlockResolved> {
    if (!block.key.trim()) {
      return AIResult.err({
        type: "invalid_context_config",
        message: `context block 缺少 key：${source.name}`
      });
    }
    if (!block.content.trim()) {
      return AIResult.err({
        type: "invalid_context_config",
        message: `context block 内容为空：${source.name}/${block.key}`
      });
    }
    return AIResult.ok({
      ...block,
      source: source.name,
      order,
      role: block.role ?? role ?? this.defaultRole,
      priority: block.priority ?? source.priority ?? 0,
      content: block.content.trim()
    });
  }

  private toMessages(blocks: LLMContextBlockResolved[]): LLMMessageText[] {
    const grouped = new Map<LLMContextMessageRole, LLMContextBlockResolved[]>();

    for (const block of blocks) {
      const group = grouped.get(block.role) ?? [];
      group.push(block);
      grouped.set(block.role, group);
    }

    return Array.from(grouped.entries(), ([role, group]) => ({
      role,
      content: group.map(formatResolvedBlock).join("\n\n")
    }));
  }

  register(source: LLMContextSource): AIResult<void> {
    if (!source.name.trim()) {
      return AIResult.err({
        type: "invalid_context_config",
        message: "context source 缺少 name"
      });
    }
    if (this.sources.has(source.name)) {
      return AIResult.err({
        type: "invalid_context_config",
        message: `context source 重复注册：${source.name}`
      });
    }

    this.sources.set(source.name, source);
    return AIResult.ok(undefined);
  }

  unregister(name: string): AIResult<void> {
    if (!this.sources.delete(name)) {
      return AIResult.err({
        type: "invalid_context_config",
        message: `context source 不存在：${name}`
      });
    }

    return AIResult.ok(undefined);
  }

  listSources(): string[] {
    return Array.from(this.sources.keys());
  }

  async compose(
    options: LLMContextComposeOptions = {}
  ): Promise<AIResult<LLMContextComposeResult>> {
    const now = this.now();
    const runtime: LLMContextRuntime = {
      now,
      inject: this.inject,
      signal: options.signal,
      conversationID: options.conversationID,
      metadata: { ...(options.metadata ?? {}) }
    };

    const resolvedBlocks: LLMContextBlockResolved[] = [];
    const skippedSources: LLMContextSourceFailure[] = [];
    let order = 0;

    for (const source of this.sources.values()) {
      if (runtime.signal?.aborted) {
        return AIResult.err({
          type: "aborted",
          message: "context compose aborted"
        });
      }

      const sourceResult = await this.readSource(source, runtime);
      if (sourceResult.isErr()) {
        if (source.required) return sourceResult;
        skippedSources.push({ source: source.name, error: sourceResult.reason });
        continue;
      }

      for (const block of sourceResult.unwrap()) {
        if (this.isExpired(block, now)) continue;

        const normalized = this.normalizeBlock(block, source, order++, options.defaultRole);
        if (normalized.isErr()) return normalized;

        resolvedBlocks.push(normalized.unwrap());
      }
    }

    const blocks = limitResolvedBlocksChars(
      sortResolvedBlocks(resolvedBlocks),
      options.maxChars ?? this.defaultMaxChars
    );
    return AIResult.ok({
      blocks,
      skippedSources,
      messages: this.toMessages(blocks)
    });
  }
}
