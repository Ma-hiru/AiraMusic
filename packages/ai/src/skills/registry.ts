import { AIResult } from "@/result";

import type {
  AIAgentRuleDefinition,
  AIAgentSkillActivation,
  AIAgentSkillDefinition,
  AIAgentSkillMatchContext,
  AIAgentEvidenceRequirement,
  AIAgentInstructionDefinition
} from "./interface";

const SkillIDPattern = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export class AIAgentSkillRegistry {
  private readonly definitions = new Map<string, AIAgentInstructionDefinition>();

  constructor(definitions: Iterable<AIAgentInstructionDefinition> = []) {
    const registered = this.register(Array.from(definitions));
    if (registered.isErr()) throw registered.reason;
  }

  register(
    definition: AIAgentInstructionDefinition | readonly AIAgentInstructionDefinition[]
  ): AIResult<void> {
    const items = (Array.isArray(definition) ? definition : [definition]).map((item) =>
      this.snapshot(item)
    );
    const incomingIDs = new Set<string>();

    for (const item of items) {
      const valid = this.validate(item);
      if (valid.isErr()) return valid;
      if (this.definitions.has(item.id) || incomingIDs.has(item.id)) {
        return AIResult.err({
          type: "invalid_skill_config",
          message: `Skill/Rule 重复注册：${item.id}`
        });
      }
      incomingIDs.add(item.id);
    }

    for (const item of items) this.definitions.set(item.id, item);
    return AIResult.ok(undefined);
  }

  /**
   * 规则不随轮次变化，因此其消息可以固定在请求开头，保持模型服务提供方
   * 前缀缓存的命中条件。
   */
  stableInstructions(): string[] {
    return Array.from(this.definitions.values())
      .filter((definition): definition is AIAgentRuleDefinition => definition.kind === "rule")
      .map((definition) => this.render(definition));
  }

  activate(context: AIAgentSkillMatchContext): AIResult<AIAgentSkillActivation> {
    const activeSkillIDs: string[] = [];
    const instructions: string[] = [];
    const toolNames = new Set<string>();
    const requiredEvidence = new Map<string, AIAgentEvidenceRequirement>();

    for (const definition of this.definitions.values()) {
      if (definition.kind === "rule") {
        for (const toolName of definition.toolNames ?? []) toolNames.add(toolName);
        continue;
      }

      let active: boolean;
      try {
        active = definition.match(context);
      } catch (error) {
        return AIResult.err({
          type: "invalid_skill_config",
          message: `Skill matcher 执行失败：${definition.id}`,
          raw: error
        });
      }
      if (!active) continue;

      activeSkillIDs.push(definition.id);
      instructions.push(this.render(definition));
      for (const toolName of definition.toolNames ?? []) toolNames.add(toolName);
      for (const requirement of definition.requiredEvidence ?? []) {
        for (const toolName of requirement.toolNames) toolNames.add(toolName);
        requiredEvidence.set(`${definition.id}:${requirement.id}`, {
          ...structuredClone(requirement),
          id: `${definition.id}:${requirement.id}`,
          ...(requirement.argumentFromEvidence
            ? {
                argumentFromEvidence: {
                  ...requirement.argumentFromEvidence,
                  evidenceID: `${definition.id}:${requirement.argumentFromEvidence.evidenceID}`
                }
              }
            : {}),
          ...(requirement.dependsOn
            ? {
                dependsOn: requirement.dependsOn.map(
                  (dependency) => `${definition.id}:${dependency}`
                )
              }
            : {})
        });
      }
    }

    return AIResult.ok({
      activeSkillIDs,
      instructions,
      toolNames: Array.from(toolNames),
      requiredEvidence: Array.from(requiredEvidence.values())
    });
  }

  private validate(definition: AIAgentInstructionDefinition): AIResult<void> {
    if (!SkillIDPattern.test(definition.id)) {
      return AIResult.err({
        type: "invalid_skill_config",
        message: `Skill/Rule id 不合法：${definition.id || "<empty>"}`
      });
    }

    const instructions = this.normalizeInstructions(definition.instructions);
    if (!instructions.length) {
      return AIResult.err({
        type: "invalid_skill_config",
        message: `Skill/Rule 缺少 instructions：${definition.id}`
      });
    }

    for (const toolName of definition.toolNames ?? []) {
      if (!toolName.trim()) {
        return AIResult.err({
          type: "invalid_skill_config",
          message: `Skill/Rule 包含空工具名：${definition.id}`
        });
      }
    }

    if (definition.kind === "skill" && typeof definition.match !== "function") {
      return AIResult.err({
        type: "invalid_skill_config",
        message: `Skill 缺少 matcher：${definition.id}`
      });
    }

    if (definition.kind === "skill") {
      const configuredRequirementIDs = new Set(
        (definition.requiredEvidence ?? []).map((requirement) => requirement.id)
      );
      const requirementIDs = new Set<string>();
      for (const requirement of definition.requiredEvidence ?? []) {
        if (!SkillIDPattern.test(requirement.id) || requirementIDs.has(requirement.id)) {
          return AIResult.err({
            type: "invalid_skill_config",
            message: `Skill 证据 id 不合法或重复：${definition.id}:${requirement.id || "<empty>"}`
          });
        }
        requirementIDs.add(requirement.id);
        if (!requirement.description.trim() || !requirement.toolNames.length) {
          return AIResult.err({
            type: "invalid_skill_config",
            message: `Skill 证据缺少说明或工具：${definition.id}:${requirement.id}`
          });
        }
        if (requirement.toolNames.some((name) => !name.trim())) {
          return AIResult.err({
            type: "invalid_skill_config",
            message: `Skill 证据包含空工具名：${definition.id}:${requirement.id}`
          });
        }
        if (
          requirement.dependsOn?.some(
            (dependency) =>
              dependency === requirement.id || !configuredRequirementIDs.has(dependency)
          )
        ) {
          return AIResult.err({
            type: "invalid_skill_config",
            message: `Skill 证据依赖不存在或指向自身：${definition.id}:${requirement.id}`
          });
        }
        const argumentSource = requirement.argumentFromEvidence;
        if (
          argumentSource &&
          (!argumentSource.argumentName.trim() ||
            argumentSource.evidenceID === requirement.id ||
            !configuredRequirementIDs.has(argumentSource.evidenceID) ||
            !requirement.dependsOn?.includes(argumentSource.evidenceID) ||
            !argumentSource.outputPath.length ||
            argumentSource.outputPath.length > 16 ||
            argumentSource.outputPath.some((segment) => !segment.trim()))
        ) {
          return AIResult.err({
            type: "invalid_skill_config",
            message: `Skill 证据参数来源无效：${definition.id}:${requirement.id}`
          });
        }
      }
    }

    return AIResult.ok(undefined);
  }

  private render(definition: AIAgentRuleDefinition | AIAgentSkillDefinition): string {
    const tag = definition.kind === "rule" ? "agent_rule" : "active_skill";
    return `<${tag} id="${definition.id}">\n${this.normalizeInstructions(definition.instructions).join("\n")}\n</${tag}>`;
  }

  private snapshot(definition: AIAgentInstructionDefinition): AIAgentInstructionDefinition {
    const shared = {
      id: definition.id,
      instructions: this.normalizeInstructions(definition.instructions),
      ...(definition.toolNames
        ? { toolNames: Array.from(new Set(definition.toolNames.map((name) => name.trim()))) }
        : {})
    };
    return definition.kind === "rule"
      ? { ...shared, kind: "rule" }
      : {
          ...shared,
          kind: "skill",
          match: definition.match,
          ...(definition.requiredEvidence
            ? { requiredEvidence: structuredClone(definition.requiredEvidence) }
            : {})
        };
  }

  private normalizeInstructions(instructions: string | readonly string[]): string[] {
    return (Array.isArray(instructions) ? instructions : [instructions])
      .map((instruction) => instruction.trim())
      .filter(Boolean);
  }
}
