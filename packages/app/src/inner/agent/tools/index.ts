import { McpToolRisk, type McpTool } from "@/types/tool";
import { MainAgentToolCatalog } from "@/lib/agent/catalog";

import { innerTools } from "./inner";
import { rendererTools } from "./renderer";

export const tools: readonly McpTool[] = [...innerTools, ...rendererTools];
export const agentToolCatalog = new MainAgentToolCatalog(tools);

export function createAgentToolCatalog(enableDestructive: boolean) {
  const list = agentToolCatalog.list.filter(
    (tool) => enableDestructive || tool.risk !== McpToolRisk.Destructive
  );
  return {
    list,
    parallelSafeNames: list
      .filter((tool) => tool.risk === McpToolRisk.Read)
      .map((tool) => tool.name)
  };
}
