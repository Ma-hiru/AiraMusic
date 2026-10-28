import { z } from "zod";
import { McpToolRisk } from "@mahiru/app/types/tool";
import { MainAgentTool } from "@mahiru/app/lib/agent/tool";
import { MainAgentToolCatalog } from "@mahiru/app/lib/agent/catalog";
import { agentToolCatalog, createAgentToolCatalog } from "@mahiru/app/inner/agent/tools";

vi.mock("@mahiru/app/lib/web-search", () => ({ WebBrowser: {} }));

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), off: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("Aira MCP 工具目录", () => {
  it("可选列表覆盖完整应用工具目录", () => {
    const catalogNames = createAgentToolCatalog(true)
      .list.map((tool) => tool.name)
      .sort((left, right) => left.localeCompare(right));

    expect(agentToolCatalog.names).toEqual(catalogNames);
    expect(agentToolCatalog.names).toContain("agent-tool-player-queue-remove");
    expect(agentToolCatalog.names).toContain("agent-tool-track-play");
    expect(agentToolCatalog.names).toContain("agent-tool-playlist-delete");
  });

  it("可选列表每一项都能解析", () => {
    const tools = agentToolCatalog.resolve(agentToolCatalog.names);
    expect(tools.map((tool) => tool.name)).toEqual(agentToolCatalog.names);
  });

  it("默认勾选是只读子集，破坏性与控制类默认关闭", () => {
    expect(agentToolCatalog.defaultNames).toContain("agent-search");
    expect(agentToolCatalog.defaultNames).toContain("agent-tool-track-detail");
    expect(agentToolCatalog.defaultNames).toContain("agent-tool-web-snapshot");
    expect(agentToolCatalog.defaultNames).not.toContain("agent-tool-web-execute");
    expect(agentToolCatalog.names).toContain("agent-tool-web-execute");
    expect(agentToolCatalog.defaultNames).not.toContain("agent-tool-player-action");
    expect(agentToolCatalog.defaultNames).not.toContain("agent-tool-player-queue-remove");
    expect(agentToolCatalog.defaultNames).not.toContain("agent-tool-playlist-delete");
    expect(
      agentToolCatalog
        .resolve(agentToolCatalog.defaultNames)
        .every((tool) => tool.risk === McpToolRisk.Read)
    ).toBe(true);
  });

  it("按工具元数据返回 MCP annotations", () => {
    const annotations = (name: string) =>
      MainAgentTool.getMcpToolAnnotations(agentToolCatalog.resolve([name])[0]!);
    expect(annotations("agent-tool-web-snapshot")).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(annotations("agent-tool-web-execute")).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    });
    expect(annotations("agent-search")).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false
    });
    expect(annotations("agent-tool-player-action")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false
    });
    expect(annotations("agent-tool-player-queue-remove")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false
    });
  });

  it("拒绝未知工具，允许不公开任何工具", () => {
    expect(() => agentToolCatalog.resolve(["not-a-real-tool"])).toThrow("公开可选列表");
    expect(agentToolCatalog.resolve([])).toEqual([]);
  });

  it("仅主进程网页工具不依赖 renderer", () => {
    expect(agentToolCatalog.names).not.toContain("agent-tool-web-browser");
    expect(agentToolCatalog.resolve(["agent-tool-web-snapshot"])[0]!.execution).toBe("main");
    expect(agentToolCatalog.resolve(["agent-search"])[0]!.execution).toBe("renderer");
  });

  it("目录只使用注入的定义，并拒绝同名工具覆盖", () => {
    const tool = MainAgentTool.createMcpTool({
      name: "custom-tool",
      description: "自定义工具",
      risk: McpToolRisk.Read,
      inputSchema: z.object({}),
      execute: () => null
    });
    const catalog = new MainAgentToolCatalog([tool]);

    expect(catalog.names).toEqual(["custom-tool"]);
    expect(catalog.defaultNames).toEqual(["custom-tool"]);
    expect(catalog.resolve(["custom-tool"])).toEqual([tool]);
    expect(() => catalog.resolve(["agent-search"])).toThrow("公开可选列表");
    expect(() => new MainAgentToolCatalog([tool, tool])).toThrow("重复名称");
  });
});
