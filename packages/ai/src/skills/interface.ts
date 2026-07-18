import type { LLMConversation } from "@/conversations";

export interface AIAgentSkillMatchContext {
  input: string;
  conversation: LLMConversation;
}

export type AIAgentSkillMatcher = NormalFunc<[context: AIAgentSkillMatchContext], boolean>;

export type AIAgentEvidenceArgument = number | string | boolean;

export type AIAgentEvidenceSatisfaction = "attempt" | "success";

/** 最终回答前必须通过工具取得或真实尝试取得的结构化证据。 */
export interface AIAgentEvidenceRequirement {
  /** 在一次激活结果中唯一的稳定标识。 */
  id: string;
  /** 缺失时提供给模型的简短说明。 */
  description: string;
  /** 任意一个工具调用成功即可满足此项。 */
  toolNames: readonly string[];
  /** 可选的参数精确匹配条件，例如区分网页 search 与 open。 */
  argumentEquals?: Readonly<Record<string, AIAgentEvidenceArgument>>;
  /** success 要求调用成功；attempt 允许工具失败后如实说明缺口。 */
  satisfaction?: AIAgentEvidenceSatisfaction;
  /** 前置证据失败时，本项因没有可靠输入而自动跳过。 */
  dependsOn?: readonly string[];
}

interface AIAgentInstructionDefinitionBase {
  /** 用于诊断和划分提示词边界的稳定标识符。 */
  id: string;
  /** 由宿主应用编写的可信指令。 */
  instructions: string | readonly string[];
  /** 此定义激活时必须可用的工具。 */
  toolNames?: readonly string[];
}

/** 始终生效的精简规则，放在可稳定命中缓存的系统提示词前缀中。 */
export interface AIAgentRuleDefinition extends AIAgentInstructionDefinitionBase {
  kind: "rule";
}

/** 仅当匹配器接受当前轮次时才激活的任务工作流。 */
export interface AIAgentSkillDefinition extends AIAgentInstructionDefinitionBase {
  kind: "skill";
  match: AIAgentSkillMatcher;
  requiredEvidence?: readonly AIAgentEvidenceRequirement[];
}

export type AIAgentInstructionDefinition = AIAgentRuleDefinition | AIAgentSkillDefinition;

export interface AIAgentSkillActivation {
  activeSkillIDs: string[];
  /** 仅用于本次请求、注入在当前用户轮次附近的开发者消息。 */
  instructions: string[];
  /** 由常驻规则和已激活技能共同提供并完成去重的工具。 */
  toolNames: string[];
  /** 接受最终回答前必须满足的工具证据。 */
  requiredEvidence: AIAgentEvidenceRequirement[];
}
