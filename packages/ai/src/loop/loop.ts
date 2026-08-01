import { AIError, AIResult } from "@/result";
import { resolveLLMContextWindowTokens } from "@/model";
import { readLLMUsageFromError } from "@/provider/usage";
import { LLMProvider, type LLMProviderConfig } from "@/provider/interface";
import type { LLMPromptBuildResult } from "@/prompt";
import type { AIAgentEvidenceRequirement } from "@/skills";
import type { LLMToolCall, LLMToolResult, LLMToolRegistry } from "@/tools";
import type {
  LLMMessage,
  LLMGenerateRequest,
  LLMMessageToolCall,
  LLMGenerateResponse
} from "@/provider";

import type {
  LLMLoopStep,
  LLMLoopEvent,
  LLMLoopRunStream,
  LLMLoopRunOptions,
  LLMLoopEventResponse
} from "./interface";

export class LLMLoop {
  static async *run<TConfig extends LLMProviderConfig>(
    options: LLMLoopRunOptions<TConfig>
  ): LLMLoopRunStream {
    const promptResult = await options.promptBuilder.build({
      ...options,
      contextWindowTokens: resolveLLMContextWindowTokens(
        options.config.model,
        options.config.contextWindowTokens
      ),
      historyRuntime: {
        summarize: async (request) => {
          const result = await options.provider.generate(options.config, request);
          if (result.isErr()) {
            options.onUsage?.(readLLMUsageFromError(result.reason));
          } else {
            options.onUsage?.(result.unwrap().usage);
          }
          return result;
        }
      }
    });
    if (promptResult.isErr()) {
      yield promptResult;
      return promptResult;
    }

    const prompt = promptResult.unwrap();
    const steps: LLMLoopStep[] = [];
    const turnMessages: LLMMessage[] = [prompt.userMessage];
    const requestTurnMessages: LLMMessage[] = [prompt.userMessage];
    const commitUnknownTools = new Set<string>();
    const successfulEvidence = new Set<string>();
    const acceptedFailedEvidence = new Set<string>();
    const evidenceOutputs = new Map<string, unknown[]>();
    const successfulReadCalls = new Map<string, LLMToolResult>();
    const activeToolNames = options.tools?.selectedNames
      ? new Set(options.tools.selectedNames)
      : undefined;
    const activatableToolNames = new Set(options.tools?.activatableNames ?? []);
    const requiredEvidence = structuredClone(options.requiredEvidence ?? []);
    const evidenceToolChoice = options.provider.resolveToolChoice(options.config, "required");
    const maxNoEvidenceProgressSteps = this.resolveNoProgressBudget(
      options.maxNoEvidenceProgressSteps
    );
    let evidenceCorrectionSent = false;
    let noEvidenceProgressSteps = 0;
    let forceFinalResponse = false;
    let request: LLMGenerateRequest = prompt.request;
    if (requiredEvidence.length > 0 && prompt.request.tools?.length) {
      request = { ...prompt.request, toolChoice: evidenceToolChoice };
      if (evidenceToolChoice !== "required") {
        // 兼容端点无法强制调用工具时，先给出短指令，避免完整回答生成后再被证据闸门丢弃。
        const proactiveEvidenceInstruction: LLMMessage = {
          role: "system",
          content: this.buildEvidenceCorrection(requiredEvidence)
        };
        requestTurnMessages.push(proactiveEvidenceInstruction);
        const rebuilt = await this.rebuildRequest(prompt, requestTurnMessages);
        if (rebuilt.isErr()) {
          yield rebuilt;
          return rebuilt;
        }
        request = { ...rebuilt.unwrap(), toolChoice: evidenceToolChoice };
      }
    }

    for (let index = 0; index < options.maxSteps; index++) {
      if (options.signal.aborted) {
        const aborted = AIResult.err({
          type: "aborted",
          message: "loop aborted"
        });
        yield aborted;
        return aborted;
      }

      const missingBeforeRequest = this.findMissingEvidence(
        requiredEvidence,
        successfulEvidence,
        acceptedFailedEvidence
      );
      if (
        (forceFinalResponse ||
          (index === options.maxSteps - 1 && missingBeforeRequest.length === 0)) &&
        request.tools?.length
      ) {
        // 最后一个步骤必须留给自然语言回答，避免模型继续调用工具后直接撞上 max_steps。
        request = { ...request, toolChoice: "none" };
      }
      const responseResult = yield* this.runStream(
        options.provider,
        options.config,
        request,
        index,
        missingBeforeRequest.length === 0,
        options.onUsage
      );
      if (responseResult.isErr()) {
        yield responseResult;
        return responseResult;
      }

      const response = responseResult.unwrap();
      // 没有工具调用，说明已经生成最终回复
      if (!response.toolCalls.length) {
        const missingEvidence = this.findMissingEvidence(
          requiredEvidence,
          successfulEvidence,
          acceptedFailedEvidence
        );
        if (missingEvidence.length) {
          // 被证据闸门丢弃的提前回答仍然产生了账单，必须计入本轮用量。
          options.onUsage?.(response.usage);
          if (evidenceCorrectionSent || !request.tools?.length) {
            const missing = AIResult.err({
              type: "bad_response",
              message: `模型未完成 Skill 要求的工具取证：${missingEvidence
                .map((requirement) => requirement.description)
                .join("、")}`
            });
            yield missing;
            return missing;
          }

          evidenceCorrectionSent = true;
          requestTurnMessages.push({
            role: "system",
            content: this.buildEvidenceCorrection(missingEvidence)
          });
          const rebuilt = await this.rebuildRequest(prompt, requestTurnMessages);
          if (rebuilt.isErr()) {
            yield rebuilt;
            return rebuilt;
          }
          request = { ...rebuilt.unwrap(), toolChoice: evidenceToolChoice };
          continue;
        }

        let finalText = response.text;
        if (options.transformFinalText) {
          try {
            finalText = options.transformFinalText({
              text: response.text,
              messages: structuredClone(turnMessages)
            });
          } catch (error) {
            options.onUsage?.(response.usage);
            const transformError = AIResult.err({
              type: "bad_response",
              message: "最终回复校验失败",
              raw: { error, discardPartialText: true }
            });
            yield transformError;
            return transformError;
          }
        }
        const finalResponse = { ...response, text: finalText };
        const finalMessages: LLMMessage[] = [
          ...turnMessages,
          { role: "assistant", content: finalText }
        ];
        steps.push({ response: finalResponse, toolResults: [] });

        yield AIResult.ok({
          step: index,
          type: "done",
          response: this.toEventResponse(finalResponse),
          messages: structuredClone(finalMessages),
          ...(prompt.context ? { context: prompt.context } : {})
        });
        return AIResult.ok({
          response: finalResponse,
          steps,
          context: prompt.context,
          messages: finalMessages
        });
      }
      if (!options.tools) {
        const noTools = AIResult.err({
          type: "invalid_tool_call",
          message: "模型返回了 tool call，但 loop 没有配置 tools"
        });
        yield noTools;
        return noTools;
      }
      const tools = options.tools;

      const toolCallMessage: LLMMessageToolCall = {
        role: "assistant",
        toolCalls: response.toolCalls,
        ...(response.text ? { content: response.text } : {}),
        ...(response.providerContext
          ? { providerContext: structuredClone(response.providerContext) }
          : {})
      };
      yield AIResult.ok({
        step: index,
        type: "tool_call",
        message: structuredClone(toolCallMessage),
        usage: response.usage,
        toolCalls: structuredClone(response.toolCalls),
        finishReason: response.finishReason,
        ...(response.text ? { text: response.text } : {})
      });

      let toolResults: LLMToolResult[] = [];
      const toolMessages: LLMMessage[] = [];
      const attemptedCallIDs = new Set<string>();
      const successfulCallIDs = new Set<string>();
      const pendingToolActivations = new Set<string>();
      let reusedReadCall = false;

      const executeCall = async (call: LLMToolCall): Promise<LLMToolResult> => {
        const requestedToolActivations = new Set<string>();
        if (!tools.registry.isParallelSafe(call.name) && !tools.registry.isReuseSafe(call.name)) {
          // 任意动作都可能改变随后读取的资源状态，先清空本轮稳定查询缓存。
          successfulReadCalls.clear();
        }
        if (commitUnknownTools.has(call.name)) {
          return this.buildToolError(
            call,
            new AIError({
              type: "commit_unknown",
              message: `该副作用工具上一请求的提交状态未知，禁止在同一轮自动重试：${call.name}`
            })
          );
        }
        const readSignature = tools.registry.isReuseSafe(call.name)
          ? await this.createToolCallSignature(call, tools.registry)
          : undefined;
        const cached = readSignature ? successfulReadCalls.get(readSignature) : undefined;
        if (cached) {
          reusedReadCall = true;
          attemptedCallIDs.add(call.callID);
          successfulCallIDs.add(call.callID);
          return {
            ...cached,
            callID: call.callID,
            // 旧结果可能已被请求滑窗裁掉；命中缓存时必须把可见结果重新交给模型。
            output: cached.output
          };
        }
        const toolResult = await tools.registry.execute(
          call,
          {
            signal: options.signal,
            conversationID: options.conversation.id,
            ...(activeToolNames
              ? {
                  activateTools: (names: readonly string[]) => {
                    for (const name of names) {
                      if (activatableToolNames.has(name)) requestedToolActivations.add(name);
                    }
                  }
                }
              : {})
          },
          activeToolNames ? [...activeToolNames] : undefined
        );

        if (toolResult.isErr()) {
          if (this.didReachToolExecution(toolResult.reason)) attemptedCallIDs.add(call.callID);
          if (toolResult.reason.type === "commit_unknown") commitUnknownTools.add(call.name);
          return this.buildToolError(call, toolResult.reason);
        }
        attemptedCallIDs.add(call.callID);
        successfulCallIDs.add(call.callID);
        const result = toolResult.unwrap();
        for (const name of requestedToolActivations) pendingToolActivations.add(name);
        if (readSignature) successfulReadCalls.set(readSignature, result);
        return result;
      };

      for (let callIndex = 0; callIndex < response.toolCalls.length; ) {
        const call = response.toolCalls[callIndex];
        if (!call) break;

        if (!tools.registry.isParallelSafe(call.name)) {
          toolResults.push(await executeCall(call));
          callIndex += 1;
          continue;
        }

        const batch: LLMToolCall[] = [];
        while (callIndex < response.toolCalls.length) {
          const candidate = response.toolCalls[callIndex];
          if (!candidate || !tools.registry.isParallelSafe(candidate.name)) break;
          batch.push(candidate);
          callIndex += 1;
        }
        toolResults.push(...(await Promise.all(batch.map(executeCall))));
      }

      for (const name of pendingToolActivations) activeToolNames?.add(name);

      if (tools.maxTotalOutputChars !== undefined) {
        const totalLimit = Math.max(256, Math.floor(tools.maxTotalOutputChars));
        let remainingBudget = totalLimit;
        let remainingResults = toolResults.length;
        toolResults = toolResults.map((result) => {
          const allowance = Math.max(0, Math.floor(remainingBudget / remainingResults));
          let output = result.output;
          if (output.length > allowance) {
            if (allowance >= 256) {
              output = tools.registry.limitOutput(output, allowance);
            } else {
              output = "[本步工具结果预算已用尽]".slice(0, allowance);
            }
          }
          remainingBudget -= output.length;
          remainingResults -= 1;
          return output === result.output ? result : { ...result, output };
        });
      }

      for (const result of toolResults) {
        toolMessages.push({
          role: "tool",
          name: result.name,
          callID: result.callID,
          content: result.output
        });
      }

      for (const call of response.toolCalls) {
        const result = toolResults.find((candidate) => candidate.callID === call.callID);
        this.recordEvidenceOutcome(
          call,
          result,
          attemptedCallIDs.has(call.callID),
          successfulCallIDs.has(call.callID),
          requiredEvidence,
          successfulEvidence,
          acceptedFailedEvidence,
          evidenceOutputs
        );
      }

      turnMessages.push(toolCallMessage, ...toolMessages);
      // 持久化消息保留首次裁剪后的完整结果；请求工作副本可以独立压缩，不能共享对象引用。
      requestTurnMessages.push(structuredClone(toolCallMessage), ...structuredClone(toolMessages));
      steps.push({ response, toolResults });
      yield AIResult.ok({
        step: index,
        type: "tool_result",
        toolResults,
        messages: structuredClone(turnMessages)
      });

      const missingAfterTools = this.findMissingEvidence(
        requiredEvidence,
        successfulEvidence,
        acceptedFailedEvidence
      );
      if (reusedReadCall && missingAfterTools.length === 0) forceFinalResponse = true;
      if (
        missingAfterTools.length > 0 &&
        this.sameEvidenceRequirements(missingBeforeRequest, missingAfterTools)
      ) {
        noEvidenceProgressSteps += 1;
        if (noEvidenceProgressSteps === 1) {
          requestTurnMessages.push({
            role: "system",
            content: this.buildEvidenceNoProgressCorrection(missingAfterTools)
          });
        }
      } else {
        noEvidenceProgressSteps = 0;
      }

      if (noEvidenceProgressSteps >= maxNoEvidenceProgressSteps) {
        const stalled = AIResult.err({
          type: "bad_response",
          message: `模型连续 ${noEvidenceProgressSteps} 步调用工具但未推进必要取证：${missingAfterTools
            .map((requirement) => requirement.description)
            .join("、")}`
        });
        yield stalled;
        return stalled;
      }

      if (tools.maxRetainedToolOutputChars !== undefined) {
        this.compactRequestToolOutputs(
          requestTurnMessages,
          tools.registry,
          tools.maxRetainedToolOutputChars
        );
      }

      // 更新请求，准备下一次循环
      const toolConfiguration = activeToolNames
        ? {
            toolChoice: tools.choice,
            tools: tools.registry.definitions(tools.strict, [...activeToolNames])
          }
        : undefined;
      const rebuilt = await this.rebuildRequest(prompt, requestTurnMessages, toolConfiguration);
      if (rebuilt.isErr()) {
        yield rebuilt;
        return rebuilt;
      }
      const nextRequest = rebuilt.unwrap();
      const stillMissingEvidence = this.findMissingEvidence(
        requiredEvidence,
        successfulEvidence,
        acceptedFailedEvidence
      ).length;
      request =
        forceFinalResponse && nextRequest.tools?.length
          ? { ...nextRequest, toolChoice: "none" }
          : stillMissingEvidence && nextRequest.tools?.length
            ? { ...nextRequest, toolChoice: evidenceToolChoice }
            : nextRequest;
    }

    const maxStepError = AIResult.err({
      type: "max_steps",
      message: `loop 达到最大步数仍未生成最终回复：${options.maxSteps}`
    });
    yield maxStepError;
    return maxStepError;
  }

  private static buildToolError(call: LLMToolCall, error: AIError): LLMToolResult {
    const internal =
      error.raw &&
      typeof error.raw === "object" &&
      "visibility" in error.raw &&
      error.raw.visibility === "internal";
    const raw = internal
      ? {
          _meta: { visibility: "internal" },
          error: {
            type: error.type,
            code: "not_selected",
            message: "该工具当前不可用，请改用已提供的工具。"
          }
        }
      : {
          error: {
            type: error.type,
            message: error.message
          },
          call
        };
    return {
      raw,
      name: call.name,
      callID: call.callID,
      output: JSON.stringify(raw)
    };
  }

  private static buildEvidenceCorrection(requirements: readonly AIAgentEvidenceRequirement[]) {
    const lines = requirements.map(
      (requirement) =>
        `- ${requirement.description}（可用工具：${requirement.toolNames.join(" / ")}）`
    );
    return [
      "<required_evidence_correction>",
      "你刚才试图在必要取证尚未完成时直接回答。先完成以下工具取证，再基于真实结果作答：",
      ...lines,
      "不要解释这条内部纠正，也不要用模型记忆替代工具结果。",
      "</required_evidence_correction>"
    ].join("\n");
  }

  /** 停滞预算默认 3 步；非法输入回退默认值，上限 12 防止失控循环。 */
  private static resolveNoProgressBudget(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return 3;
    return Math.min(12, Math.max(1, Math.floor(value)));
  }

  private static buildEvidenceNoProgressCorrection(
    requirements: readonly AIAgentEvidenceRequirement[]
  ) {
    return [
      "<required_evidence_no_progress>",
      "刚才的工具调用没有推进必要取证。不要重复搜索或重复读取已有内容，改为完成仍缺少的步骤：",
      ...requirements.map((requirement) => `- ${requirement.description}`),
      "</required_evidence_no_progress>"
    ].join("\n");
  }

  private static sameEvidenceRequirements(
    left: readonly AIAgentEvidenceRequirement[],
    right: readonly AIAgentEvidenceRequirement[]
  ) {
    if (left.length !== right.length) return false;
    const rightIDs = new Set(right.map((requirement) => requirement.id));
    return left.every((requirement) => rightIDs.has(requirement.id));
  }

  private static async createToolCallSignature(
    call: LLMToolCall,
    registry: LLMToolRegistry
  ): Promise<string | undefined> {
    const normalized = await registry.normalizeCallArguments(call);
    if (normalized.isErr()) return undefined;
    const { input, outputDetail } = normalized.unwrap();
    return `${call.name}\u0000${JSON.stringify({
      detail: outputDetail,
      input: this.sortToolArguments(input)
    })}`;
  }

  /**
   * 仅压缩下一步请求的工作副本：按时间倒序优先保留最近结果，旧结果留下来源位置占位。
   * 这与历史摘要分工明确，避免多步工具循环反复计费同一批大结果。
   */
  private static compactRequestToolOutputs(
    messages: LLMMessage[],
    registry: LLMToolRegistry,
    maxChars: number
  ) {
    const budget = Math.max(256, Math.floor(maxChars));
    const toolMessages = messages.filter(
      (message): message is Extract<LLMMessage, { role: "tool" }> => message.role === "tool"
    );
    const originals = toolMessages.map((message) => message.content);
    const originalTotal = originals.reduce((total, content) => total + content.length, 0);
    if (originalTotal <= budget) return;

    const placeholders = toolMessages.map((message, index) =>
      JSON.stringify({
        _meta: {
          pruned: true,
          tool: message.name,
          originalChars: originals[index]?.length ?? 0
        },
        message: "旧工具结果已从当前工作上下文裁剪；必要时请使用游标或精确参数继续读取。"
      })
    );
    for (let index = 0; index < toolMessages.length; index += 1) {
      toolMessages[index]!.content = placeholders[index]!;
    }

    let retainedChars = placeholders.reduce((total, content) => total + content.length, 0);
    if (retainedChars > budget) {
      for (let index = 0; index < toolMessages.length; index += 1) {
        toolMessages[index]!.content = "[旧工具结果已裁剪]";
      }
      retainedChars = toolMessages.reduce((total, message) => total + message.content.length, 0);
      for (let index = 0; retainedChars > budget && index < toolMessages.length; index += 1) {
        retainedChars -= toolMessages[index]!.content.length;
        toolMessages[index]!.content = "";
      }
    }

    for (let index = toolMessages.length - 1; index >= 0; index -= 1) {
      const message = toolMessages[index]!;
      const original = originals[index]!;
      const extraBudget = Math.max(0, budget - retainedChars);
      const fullExtra = original.length - message.content.length;
      if (fullExtra <= extraBudget) {
        retainedChars += fullExtra;
        message.content = original;
        continue;
      }
      if (extraBudget >= 256) {
        const projected = registry.limitOutput(original, message.content.length + extraBudget);
        retainedChars += projected.length - message.content.length;
        message.content = projected;
      }
      break;
    }
  }

  private static sortToolArguments(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortToolArguments(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, this.sortToolArguments(item)])
    );
  }

  private static recordEvidenceOutcome(
    call: LLMToolCall,
    result: Undefinable<LLMToolResult>,
    attempted: boolean,
    succeeded: boolean,
    requirements: readonly AIAgentEvidenceRequirement[],
    successful: Set<string>,
    acceptedFailed: Set<string>,
    evidenceOutputs: Map<string, unknown[]>
  ) {
    let args: unknown;
    try {
      args = JSON.parse(call.arguments);
    } catch {
      args = undefined;
    }

    for (const requirement of requirements) {
      if (!requirement.toolNames.includes(call.name)) continue;
      const expected = requirement.argumentEquals;
      if (expected) {
        if (!args || typeof args !== "object" || Array.isArray(args)) continue;
        const record = args as Record<string, unknown>;
        if (Object.entries(expected).some(([key, value]) => record[key] !== value)) continue;
      }
      const argumentSource = requirement.argumentFromEvidence;
      if (argumentSource) {
        if (!args || typeof args !== "object" || Array.isArray(args)) continue;
        const argument = (args as Record<string, unknown>)[argumentSource.argumentName];
        const sourceOutputs = evidenceOutputs.get(argumentSource.evidenceID) ?? [];
        const sourceValues = this.readEvidencePath(sourceOutputs, argumentSource.outputPath);
        if (!sourceValues.some((value) => this.evidenceValueEquals(value, argument))) {
          continue;
        }
      }
      if (succeeded) {
        // 证据只能来自实际发给模型的结果；raw 可能包含已被预算裁掉的字段。
        const parsedOutput = result ? this.parseEvidenceOutput(result.output) : undefined;
        const dependentSources = requirements.flatMap((candidate) =>
          candidate.argumentFromEvidence?.evidenceID === requirement.id
            ? [candidate.argumentFromEvidence]
            : []
        );
        if (
          dependentSources.length &&
          (parsedOutput === undefined ||
            dependentSources.some(
              (source) => !this.readEvidencePath(parsedOutput, source.outputPath).length
            ))
        ) {
          // 工具执行成功但没有产生依赖项可用的候选，也属于一次真实尝试。
          if (
            attempted &&
            requirement.satisfaction === "attempt" &&
            !successful.has(requirement.id)
          ) {
            acceptedFailed.add(requirement.id);
          }
          continue;
        }
        if (
          requirement.minimumOutputChars !== undefined &&
          this.countEvidenceOutputChars(
            requirement.outputPath
              ? this.readEvidencePath(parsedOutput, requirement.outputPath)
              : parsedOutput
          ) < requirement.minimumOutputChars
        ) {
          // “调用成功但正文为空”不能降级成 attempt，否则模型会把空页面当成已阅读。
          continue;
        }
        successful.add(requirement.id);
        acceptedFailed.delete(requirement.id);
        if (parsedOutput !== undefined) {
          evidenceOutputs.set(requirement.id, [
            ...(evidenceOutputs.get(requirement.id) ?? []),
            parsedOutput
          ]);
        }
        continue;
      }
      if (attempted && requirement.satisfaction === "attempt" && !successful.has(requirement.id)) {
        acceptedFailed.add(requirement.id);
      }
    }
  }

  private static parseEvidenceOutput(output: unknown): unknown {
    if (typeof output !== "string") return output;
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }

  private static countEvidenceOutputChars(value: unknown): number {
    if (Array.isArray(value)) {
      return value.reduce((total, item) => total + this.countEvidenceOutputChars(item), 0);
    }
    if (typeof value === "string") return value.trim().length;
    if (value === undefined || value === null) return 0;
    try {
      return JSON.stringify(value).length;
    } catch {
      return String(value).length;
    }
  }

  private static readEvidencePath(
    value: unknown,
    path: readonly string[],
    pathIndex = 0,
    depth = 0
  ): unknown[] {
    if (depth > 16 || value === undefined || value === null) return [];
    if (pathIndex >= path.length) return [value];
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.readEvidencePath(item, path, pathIndex, depth + 1));
    }
    if (typeof value !== "object") return [];
    const segment = path[pathIndex];
    if (!segment) return [];
    return this.readEvidencePath(
      (value as Record<string, unknown>)[segment],
      path,
      pathIndex + 1,
      depth + 1
    );
  }

  private static evidenceValueEquals(candidate: unknown, expected: unknown): boolean {
    if (candidate === expected) return true;
    if (typeof candidate !== "string" || typeof expected !== "string") return false;
    const candidateURL = this.normalizeEvidenceURL(candidate);
    const expectedURL = this.normalizeEvidenceURL(expected);
    return candidateURL !== undefined && candidateURL === expectedURL;
  }

  private static normalizeEvidenceURL(value: string): string | undefined {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) return undefined;
      url.hash = "";
      url.searchParams.sort();
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
      return url.href;
    } catch {
      return undefined;
    }
  }

  private static findMissingEvidence(
    requirements: readonly AIAgentEvidenceRequirement[],
    successful: ReadonlySet<string>,
    acceptedFailed: ReadonlySet<string>
  ): AIAgentEvidenceRequirement[] {
    const satisfied = new Set([...successful, ...acceptedFailed]);
    const unavailable = new Set(acceptedFailed);
    let changed = true;
    while (changed) {
      changed = false;
      for (const requirement of requirements) {
        if (satisfied.has(requirement.id) || !requirement.dependsOn?.length) continue;
        if (
          !requirement.dependsOn.some(
            (dependency) => unavailable.has(dependency) && satisfied.has(dependency)
          )
        ) {
          continue;
        }
        // 例如网页搜索失败后没有可信 URL，不能再强迫模型执行 open。
        satisfied.add(requirement.id);
        unavailable.add(requirement.id);
        changed = true;
      }
    }
    return requirements.filter((requirement) => !satisfied.has(requirement.id));
  }

  private static didReachToolExecution(error: AIError) {
    return !["invalid_tool_call", "invalid_tool_config", "unknown_tool"].includes(error.type);
  }

  private static async rebuildRequest(
    prompt: LLMPromptBuildResult,
    requestTurnMessages: readonly LLMMessage[],
    toolConfiguration?: Pick<LLMGenerateRequest, "tools" | "toolChoice">
  ): Promise<AIResult<LLMGenerateRequest>> {
    if (prompt.historyBudget) {
      if (toolConfiguration) prompt.historyBudget.setToolConfiguration(toolConfiguration);
      const fitted = await prompt.historyBudget.fit([
        ...(prompt.transientMessages ?? []),
        ...requestTurnMessages
      ]);
      if (fitted.isErr()) return fitted;
      return AIResult.ok(fitted.unwrap().request);
    }

    return AIResult.ok({
      ...prompt.request,
      ...toolConfiguration,
      messages: [
        ...prompt.request.messages,
        // 去掉用户消息，因为初始请求中已经包含该消息。
        ...requestTurnMessages.slice(1)
      ]
    });
  }

  private static async *runStream<TConfig extends LLMProviderConfig>(
    provider: LLMProvider<TConfig>,
    config: TConfig,
    request: LLMGenerateRequest,
    step: number,
    emitTextDeltas = true,
    onUsage?: LLMLoopRunOptions<TConfig>["onUsage"]
  ): AsyncGenerator<AIResult<LLMLoopEvent>, AIResult<LLMGenerateResponse>> {
    for await (const eventResult of provider.stream(config, request)) {
      if (eventResult.isErr()) {
        onUsage?.(readLLMUsageFromError(eventResult.reason));
        return eventResult;
      }

      const event = eventResult.unwrap();
      if (event.type === "text_delta") {
        if (emitTextDeltas) yield AIResult.ok({ step, type: "text_delta", text: event.text });
        continue;
      }

      return AIResult.ok(event);
    }

    return AIResult.err({
      type: "bad_response",
      message: "provider stream 缺少 done 事件"
    });
  }

  private static toEventResponse(response: LLMGenerateResponse): LLMLoopEventResponse {
    return {
      text: response.text,
      usage: response.usage,
      toolCalls: structuredClone(response.toolCalls),
      finishReason: response.finishReason
    };
  }
}
