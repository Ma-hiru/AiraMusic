import { render, screen, cleanup } from "@testing-library/react";
import AgentSettings from "@mahiru/ui/common/components/page/settings/content/agent";

const { state } = vi.hoisted(() => ({
  state: {
    agentEnabled: true,
    mcpEnabled: true,
    mcpPort: 32_123,
    mcpTools: ["agent-search", "agent-tool-player-action", "agent-tool-comment-send"],
    restartRequired: false,
    effective: {
      agentEnabled: true,
      mcpEnabled: true,
      mcpPort: 32_123,
      mcpTools: ["agent-search", "agent-tool-player-action", "agent-tool-comment-send"]
    },
    availableMcpTools: [
      {
        name: "agent-search",
        label: "搜索音乐",
        description: "搜索歌曲、专辑和艺人。",
        risk: "read" as const
      },
      {
        name: "agent-tool-player-action",
        label: "控制播放",
        description: "控制播放器播放状态。",
        risk: "write" as const
      },
      {
        name: "agent-tool-comment-send",
        label: "发送评论",
        description: "发送或回复评论。",
        risk: "destructive" as const
      }
    ]
  }
}));

vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: {
    NormalChannel: {
      send: vi.fn().mockResolvedValue({ ok: true, data: state })
    },
    MessageChannel: {
      listen: vi.fn(() => vi.fn())
    }
  }
}));

vi.mock("@/common/components/display/toast", () => ({
  default: { show: vi.fn() }
}));

afterEach(cleanup);

describe("Agent 功能设置", () => {
  it("区分内部 Agent MCP 与外部接入，并标识公共工具风险", async () => {
    render(<AgentSettings />);

    expect(await screen.findByText("外部 MCP 接入")).toBeInTheDocument();
    expect(screen.getByText(/Rust Agent 始终通过内部凭证使用完整工具目录/)).toBeInTheDocument();
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(screen.getByText("写操作")).toBeInTheDocument();
    expect(screen.getByText("高风险")).toBeInTheDocument();
  });
});
