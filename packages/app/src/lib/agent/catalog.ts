import { McpToolRisk, type McpTool } from "@/types/tool";

/** 工具目录只管理传入的定义，不创建应用工具或读取运行配置。 */
export class MainAgentToolCatalog {
  readonly list: readonly McpTool[];
  readonly names: readonly string[];
  readonly defaultNames: readonly string[];
  private readonly byName: ReadonlyMap<string, McpTool>;

  constructor(tools: readonly McpTool[]) {
    this.list = [...tools];
    this.byName = new Map(tools.map((tool) => [tool.name, tool]));
    if (this.byName.size !== tools.length) throw new Error("工具目录包含重复名称");
    this.names = [...this.byName.keys()].sort((left, right) => left.localeCompare(right));
    this.defaultNames = this.names.filter(
      (name) => this.byName.get(name)!.risk === McpToolRisk.Read
    );
  }

  resolve(names: readonly string[]): McpTool[] {
    return names.map((name) => {
      const tool = this.byName.get(name);
      if (!tool) throw new Error(`MCP 工具不在公开可选列表中：${name}`);
      return tool;
    });
  }
}
