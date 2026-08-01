import { createAgentToolCatalog } from "@mahiru/app/inner/agent/tool-catalog";
import {
  AiraPublicMcpToolNames,
  AiraDefaultMcpToolNames,
  getAiraMcpToolAnnotations,
  isAiraMcpMutatingToolName,
  resolveAiraPublicMcpTools,
  isAiraMcpDestructiveToolName,
  doesAiraMcpToolRequireRenderer,
  validateAiraPublicMcpToolNames
} from "@mahiru/app/inner/mcp/public-tools";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), off: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("Aira MCP 工具可选列表", () => {
  it("可选列表覆盖完整 Agent 工具目录（排除内部路由工具）", () => {
    const catalogNames = createAgentToolCatalog(true)
      .list.map((tool) => tool.name)
      .filter((name) => name !== "agent-tool-capability-search")
      .sort((left, right) => left.localeCompare(right));

    expect([...AiraPublicMcpToolNames]).toEqual(catalogNames);
    expect(AiraPublicMcpToolNames).toContain("agent-tool-player-queue-remove");
    expect(AiraPublicMcpToolNames).toContain("agent-tool-track-play");
    expect(AiraPublicMcpToolNames).toContain("agent-tool-playlist-delete");
    expect(AiraPublicMcpToolNames).not.toContain("agent-tool-capability-search");
  });

  it("可选列表每一项都能解析", () => {
    const tools = resolveAiraPublicMcpTools(AiraPublicMcpToolNames);
    expect(tools.map((tool) => tool.name).sort()).toEqual([...AiraPublicMcpToolNames].sort());
  });

  it("默认勾选是无副作用子集，破坏性与控制类默认关闭", () => {
    expect(AiraDefaultMcpToolNames.every((name) => AiraPublicMcpToolNames.includes(name))).toBe(
      true
    );
    expect(AiraDefaultMcpToolNames).toContain("agent-search");
    expect(AiraDefaultMcpToolNames).toContain("agent-tool-track-detail");
    expect(AiraDefaultMcpToolNames).not.toContain("agent-tool-player-action");
    expect(AiraDefaultMcpToolNames).not.toContain("agent-tool-player-queue-remove");
    expect(AiraDefaultMcpToolNames).not.toContain("agent-tool-playlist-delete");
    expect(AiraDefaultMcpToolNames.some(isAiraMcpDestructiveToolName)).toBe(false);
    expect(AiraDefaultMcpToolNames.some(isAiraMcpMutatingToolName)).toBe(false);
    expect(resolveAiraPublicMcpTools(AiraDefaultMcpToolNames).map((tool) => tool.name)).toEqual([
      ...AiraDefaultMcpToolNames
    ]);
  });

  it("按工具类别返回正确的 MCP annotations", () => {
    expect(getAiraMcpToolAnnotations("agent-search")).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false
    });
    expect(getAiraMcpToolAnnotations("agent-tool-player-action")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false
    });
    expect(getAiraMcpToolAnnotations("agent-tool-player-queue-remove")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false
    });
  });

  it.each(["agent-tool-capability-search", "not-a-real-tool"])("拒绝内部或未知工具 %s", (name) => {
    expect(() => validateAiraPublicMcpToolNames([name])).toThrow("公开可选列表");
  });

  it("拒绝空配置和重复工具", () => {
    expect(() => validateAiraPublicMcpToolNames([])).toThrow("至少需要配置一个");
    expect(() => validateAiraPublicMcpToolNames(["agent-search", "agent-search"])).toThrow(
      "重复配置"
    );
  });

  it("仅主进程网页工具不依赖 renderer", () => {
    expect(doesAiraMcpToolRequireRenderer("agent-tool-web-browser")).toBe(false);
    expect(doesAiraMcpToolRequireRenderer("agent-search")).toBe(true);
  });
});
