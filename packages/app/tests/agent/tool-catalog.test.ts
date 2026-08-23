import { createAgentToolCatalog } from "@mahiru/app/inner/mcp/tools/catalog";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("MCP 工具目录", () => {
  it("默认目录不包含高危工具，完整目录只增加明确分类的高危工具", () => {
    const safe = createAgentToolCatalog(false);
    const full = createAgentToolCatalog(true);
    const safeNames = safe.list.map((tool) => tool.name);
    const fullNames = full.list.map((tool) => tool.name);

    expect(new Set(fullNames).size).toBe(fullNames.length);
    expect(safeNames).toContain("agent-tool-track-detail");
    expect(safeNames).not.toContain("agent-tool-playlist-delete");
    expect(fullNames).toContain("agent-tool-playlist-delete");
    expect(fullNames).toContain("agent-tool-comment-send");
  });

  it("并行安全集合只包含目录中的只读工具", () => {
    const catalog = createAgentToolCatalog(true);
    const names = new Set(catalog.list.map((tool) => tool.name));

    expect(catalog.parallelSafeNames.every((name) => names.has(name))).toBe(true);
    expect(catalog.parallelSafeNames).toContain("agent-tool-track-detail");
    expect(catalog.parallelSafeNames).not.toContain("agent-tool-player-action");
    expect(catalog.parallelSafeNames).not.toContain("agent-tool-playlist-delete");
  });
});
