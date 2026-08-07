import type { LLMTool } from "@mahiru/ai";

import { createAgentToolCatalog } from "../agent/tool-catalog";

/** Agent 内部路由工具，不对 MCP 客户端暴露。 */
const McpExcludedToolNames = new Set(["agent-tool-capability-search"]);

const FullMcpCatalog = createAgentToolCatalog(true);
const SafeMcpCatalog = createAgentToolCatalog(false);

const SafeMcpToolNameSet: ReadonlySet<string> = new Set(
  SafeMcpCatalog.list.map((tool) => tool.name)
);
const ParallelSafeMcpToolNameSet: ReadonlySet<string> = new Set(SafeMcpCatalog.parallelSafeNames);

/**
 * MCP 可选工具 = 完整 Agent 工具目录（含破坏性），排除仅供内部路由的项。
 * 真正挂到端口上的仍由用户在设置里勾选决定。
 */
export const AiraPublicMcpToolNames: readonly string[] = FullMcpCatalog.list
  .map((tool) => tool.name)
  .filter((name) => !McpExcludedToolNames.has(name))
  .sort((left, right) => left.localeCompare(right));

/**
 * 默认勾选：非破坏、无副作用的查询类工具。
 * 播放控制、导航、写操作/破坏性工具默认关闭，由用户显式打开。
 */
export const AiraDefaultMcpToolNames: readonly string[] = AiraPublicMcpToolNames.filter((name) =>
  ParallelSafeMcpToolNameSet.has(name)
);

export type AiraPublicMcpToolName = (typeof AiraPublicMcpToolNames)[number];

const PublicToolNameSet: ReadonlySet<string> = new Set(AiraPublicMcpToolNames);
const MainProcessToolNameSet: ReadonlySet<string> = new Set(["agent-tool-web-browser"]);
const FullMcpToolByName = new Map(FullMcpCatalog.list.map((tool) => [tool.name, tool]));

export function isAiraPublicMcpToolName(name: string): name is AiraPublicMcpToolName {
  return PublicToolNameSet.has(name);
}

/** 会改变播放器/页面状态，但不一定是破坏性写操作。 */
export function isAiraMcpMutatingToolName(name: string): boolean {
  return isAiraPublicMcpToolName(name) && !ParallelSafeMcpToolNameSet.has(name);
}

/** 仅在 enableDestructive 目录中存在的工具（删队列、删歌单、发评论等）。 */
export function isAiraMcpDestructiveToolName(name: string): boolean {
  return isAiraPublicMcpToolName(name) && !SafeMcpToolNameSet.has(name);
}

/** 网页浏览器在主进程执行，其余工具仍需要 renderer 提供数据/播放服务。 */
export function doesAiraMcpToolRequireRenderer(name: string): boolean {
  return !MainProcessToolNameSet.has(name);
}

export function getAiraMcpToolAnnotations(name: string): {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
} {
  const mutating = isAiraMcpMutatingToolName(name);
  return {
    readOnlyHint: !mutating,
    destructiveHint: isAiraMcpDestructiveToolName(name),
    idempotentHint: !mutating,
    openWorldHint: name === "agent-tool-web-browser"
  };
}

export function validateAiraPublicMcpToolNames(names: readonly string[]): AiraPublicMcpToolName[] {
  if (names.length === 0) throw new Error("MCP 至少需要配置一个公开工具");

  const duplicated = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicated) throw new Error(`MCP 工具重复配置：${duplicated}`);

  const forbidden = names.filter((name) => !isAiraPublicMcpToolName(name));
  if (forbidden.length > 0) {
    throw new Error(`MCP 工具不在公开可选列表中：${forbidden.join("、")}`);
  }

  return [...names];
}

export function resolveAiraPublicMcpTools(names: readonly string[]): LLMTool[] {
  const validatedNames = validateAiraPublicMcpToolNames(names);

  return validatedNames.map((name) => {
    const tool = FullMcpToolByName.get(name);
    if (!tool) throw new Error(`MCP 工具尚未注册：${name}`);
    return tool;
  });
}
