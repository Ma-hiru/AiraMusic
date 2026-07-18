import { createAgentToolCatalog } from "@mahiru/app/inner/agent/tool-catalog";
import {
  AgentToolPlayerMode,
  AgentToolPlayerSeek,
  AgentToolTrackDetail,
  AgentToolPlayerAction,
  AgentToolPlayerVolume,
  getAgentToolTimeoutMs,
  AgentToolPlayerQueueAdd,
  AgentToolPlaylistModify,
  AgentToolPlayerQueueRemove
} from "@mahiru/app/inner/agent/tools";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("Agent 播放器工具", () => {
  it("使用明确且有界的队列参数", () => {
    const addSchema = new AgentToolPlayerQueueAdd().inputSchema;
    const removeSchema = new AgentToolPlayerQueueRemove().inputSchema;

    expect(addSchema.safeParse({ ids: [1, 2], position: "next" }).success).toBe(true);
    expect(addSchema.safeParse({ ids: [], position: "next" }).success).toBe(false);
    expect(addSchema.safeParse({ ids: [1], position: "middle" }).success).toBe(false);
    expect(removeSchema.safeParse({ scope: "tracks", ids: [1, 2] }).success).toBe(true);
    expect(removeSchema.safeParse({ scope: "tracks", ids: [] }).success).toBe(false);
    expect(removeSchema.safeParse({ scope: "all" }).success).toBe(true);
    expect(removeSchema.safeParse({ scope: "all", ids: [1] }).success).toBe(false);
  });

  it("设置播放模式时至少要求一个字段", () => {
    const schema = new AgentToolPlayerMode().inputSchema;

    expect(schema.safeParse({ repeat: "one" }).success).toBe(true);
    expect(schema.safeParse({ shuffle: true }).success).toBe(true);
    expect(schema.safeParse({ repeat: "all", shuffle: false }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("不再向 Agent 暴露关闭窗口和内部刷新动作", () => {
    const schema = new AgentToolPlayerAction().inputSchema;

    expect(schema.safeParse({ action: "play" }).success).toBe(true);
    expect(schema.safeParse({ action: "exit" }).success).toBe(false);
    expect(schema.safeParse({ action: "update" }).success).toBe(false);
  });

  it("拒绝空控制、非法进度和无界批量请求", () => {
    const volumeSchema = new AgentToolPlayerVolume().inputSchema;
    const seekSchema = new AgentToolPlayerSeek().inputSchema;
    const detailSchema = new AgentToolTrackDetail().inputSchema;
    const playlistModifySchema = new AgentToolPlaylistModify().inputSchema;

    expect(volumeSchema.safeParse({}).success).toBe(false);
    expect(volumeSchema.safeParse({ volume: 75 }).success).toBe(true);
    expect(seekSchema.safeParse({ position: "50%" }).success).toBe(true);
    expect(seekSchema.safeParse({ position: "101%" }).success).toBe(false);
    expect(seekSchema.safeParse({ position: "later" }).success).toBe(false);
    expect(detailSchema.safeParse({ ids: [], mode: "simple" }).success).toBe(false);
    expect(
      detailSchema.safeParse({ ids: Array.from({ length: 101 }, (_, index) => index + 1) }).success
    ).toBe(false);
    expect(playlistModifySchema.safeParse({ op: "add", pid: 1, trackIds: [] }).success).toBe(false);
  });

  it("仅在开启破坏性工具后暴露队列移除", () => {
    const safeCatalog = createAgentToolCatalog(false);
    const fullCatalog = createAgentToolCatalog(true);
    const safeNames = safeCatalog.list.map((tool) => tool.name);
    const fullNames = fullCatalog.list.map((tool) => tool.name);

    expect(safeNames).toContain("agent-tool-player-queue-add");
    expect(safeNames).toContain("agent-tool-player-mode");
    expect(safeNames).not.toContain("agent-tool-player-queue-remove");
    expect(fullNames).toContain("agent-tool-player-queue-remove");
    expect(fullCatalog.parallelSafeNames).not.toContain("agent-tool-player-queue-add");
    expect(fullCatalog.parallelSafeNames).not.toContain("agent-tool-player-mode");
    expect(fullCatalog.parallelSafeNames).not.toContain("agent-tool-player-queue-remove");
  });

  it("按播放器意图路由新增工具，并区分本地与联网超时", () => {
    const selected = createAgentToolCatalog(true).select("把这几首歌加入播放队列并开启随机播放");
    const removeSelected = createAgentToolCatalog(true).select("从播放队列移除这几首歌");

    expect(selected).toContain("agent-tool-player-queue-add");
    expect(selected).not.toContain("agent-tool-player-queue-remove");
    expect(selected).toContain("agent-tool-player-mode");
    expect(removeSelected).toContain("agent-tool-player-queue-remove");
    expect(getAgentToolTimeoutMs("agent-tool-player-queue-add")).toBe(30_000);
    expect(getAgentToolTimeoutMs("agent-tool-player-queue-remove")).toBe(5_000);
    expect(getAgentToolTimeoutMs("agent-tool-player-mode")).toBe(5_000);
  });
});
