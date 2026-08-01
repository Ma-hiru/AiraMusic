import { render, screen, fireEvent } from "@testing-library/react";
import ToolStep from "@mahiru/ui/wins/agent/page/chat/tool-step";
import type { AgentToolTimelineItem } from "@mahiru/ui/wins/agent/page/types";

const createItem = (
  status: AgentToolTimelineItem["status"],
  output?: string
): AgentToolTimelineItem => ({
  id: "tool-step-1",
  type: "tool",
  status,
  toolCalls: [
    {
      name: "agent-tool-track-detail",
      callID: "call-1",
      arguments: JSON.stringify({ id: 42 })
    }
  ],
  toolResults: output ? [{ name: "agent-tool-track-detail", callID: "call-1", output }] : []
});

const getStepDisclosure = (name: RegExp) => {
  const disclosure = screen
    .getAllByRole("button", { name })
    .find((button) => button.getAttribute("aria-controls")?.startsWith("agent-tool-step-"));

  expect(disclosure).toBeDefined();
  return disclosure!;
};

describe("Agent tool step disclosure", () => {
  it("运行中与最终回答流式输出期间保持展开，回答完成后自动收起", () => {
    const { rerender } = render(<ToolStep item={createItem("running")} />);
    const disclosure = getStepDisclosure(/读取歌曲详情/);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ToolStep
        autoCollapse={false}
        collapseEnabled={false}
        item={createItem(
          "done",
          JSON.stringify({ name: "夜に駆ける", artists: [{ name: "YOASOBI" }] })
        )}
      />
    );

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("夜に駆ける")).toBeInTheDocument();

    rerender(
      <ToolStep
        item={createItem(
          "done",
          JSON.stringify({ name: "夜に駆ける", artists: [{ name: "YOASOBI" }] })
        )}
        autoCollapse
        collapseEnabled
      />
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
  });

  it("历史完成结果默认收起", () => {
    render(
      <ToolStep
        item={createItem("done", JSON.stringify({ name: "群青", artists: [{ name: "YOASOBI" }] }))}
      />
    );

    const disclosure = getStepDisclosure(/读取歌曲详情/);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    const controlledRegion = document.getElementById(disclosure.getAttribute("aria-controls")!);
    expect(controlledRegion).toBeInTheDocument();
    expect(controlledRegion).toHaveAttribute("hidden");
    expect(screen.queryByText("群青")).not.toBeInTheDocument();
  });

  it("keeps an error open by default", () => {
    render(
      <ToolStep
        item={createItem(
          "done",
          JSON.stringify({ error: { type: "timeout", message: "网页读取超时" } })
        )}
      />
    );

    expect(getStepDisclosure(/读取歌曲详情/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("网页读取超时");
  });

  it("不向用户展示内部工具路由恢复结果", () => {
    render(
      <ToolStep
        item={createItem(
          "error",
          JSON.stringify({
            error: { type: "tool_not_selected", message: "内部工具路由不匹配" },
            _meta: { visibility: "internal" }
          })
        )}
      />
    );

    expect(screen.queryByText(/内部工具路由不匹配/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /读取歌曲详情/ })).not.toBeInTheDocument();
  });

  it("自动折叠策略不会覆盖用户的手动展开状态", () => {
    const { rerender } = render(
      <ToolStep item={createItem("done", JSON.stringify({ name: "夜に駆ける" }))} />
    );
    const disclosure = getStepDisclosure(/读取歌曲详情/);

    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ToolStep
        autoCollapse={false}
        collapseEnabled={false}
        item={createItem("done", JSON.stringify({ name: "夜に駆ける" }))}
      />
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ToolStep
        item={createItem("done", JSON.stringify({ name: "夜に駆ける" }))}
        autoCollapse
        collapseEnabled
      />
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ToolStep
        autoCollapse={false}
        item={createItem("done", JSON.stringify({ ok: true }))}
        collapseEnabled
      />
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
  });

  it("完成但没有返回正文时仍显示通用结果预览", () => {
    const item: AgentToolTimelineItem = {
      id: "generic-tool-step",
      type: "tool",
      status: "done",
      toolCalls: [
        {
          name: "agent-tool-custom-action",
          callID: "generic-call",
          arguments: "{}"
        }
      ],
      toolResults: []
    };

    render(<ToolStep item={item} autoCollapse={false} />);

    expect(screen.getByText("工具已完成，但没有返回可展示的内容")).toBeInTheDocument();
  });

  it("keeps raw input and output behind a second disclosure", () => {
    render(
      <ToolStep
        autoCollapse={false}
        item={createItem(
          "done",
          JSON.stringify({ name: "夜に駆ける", artists: [{ name: "YOASOBI" }] })
        )}
      />
    );
    const technicalDisclosure = screen.getByRole("button", { name: /技术详情/ });
    const controlledID = technicalDisclosure.getAttribute("aria-controls");
    const controlledRegion = document.getElementById(controlledID!);

    expect(technicalDisclosure).toHaveAttribute("aria-expanded", "false");
    expect(controlledID).toMatch(/^agent-tool-technical-/);
    expect(controlledRegion).toHaveAttribute("hidden");
    expect(technicalDisclosure).toHaveAccessibleName("读取歌曲详情技术详情");
    expect(screen.queryByText("call call-1")).not.toBeInTheDocument();

    fireEvent.click(technicalDisclosure);
    expect(technicalDisclosure).toHaveAttribute("aria-expanded", "true");
    expect(controlledRegion).not.toHaveAttribute("hidden");
    expect(screen.getByText("call call-1")).toBeInTheDocument();
    expect(screen.getByText(/"YOASOBI"/)).toBeInTheDocument();
  });

  it("gives parallel technical disclosures unique accessible names and targets", () => {
    const item: AgentToolTimelineItem = {
      ...createItem("done"),
      toolCalls: [
        {
          name: "agent-tool-track-detail",
          callID: "call-1",
          arguments: JSON.stringify({ id: 1 })
        },
        {
          name: "agent-tool-track-detail",
          callID: "call-2",
          arguments: JSON.stringify({ id: 2 })
        }
      ],
      toolResults: [
        {
          name: "agent-tool-track-detail",
          callID: "call-1",
          output: JSON.stringify({ name: "第一首歌" })
        },
        {
          name: "agent-tool-track-detail",
          callID: "call-2",
          output: JSON.stringify({ name: "第二首歌" })
        }
      ]
    };

    render(<ToolStep item={item} autoCollapse={false} />);
    const first = screen.getByRole("button", { name: "读取歌曲详情技术详情（第 1 项）" });
    const second = screen.getByRole("button", { name: "读取歌曲详情技术详情（第 2 项）" });

    expect(first.getAttribute("aria-controls")).not.toBe(second.getAttribute("aria-controls"));
    expect(document.getElementById(first.getAttribute("aria-controls")!)).toBeInTheDocument();
    expect(document.getElementById(second.getAttribute("aria-controls")!)).toBeInTheDocument();
  });

  it("shows the selected web scope and compact source list", () => {
    const item: AgentToolTimelineItem = {
      id: "web-search-1",
      type: "tool",
      status: "done",
      toolCalls: [
        {
          name: "agent-tool-web-browser",
          callID: "web-call-1",
          arguments: JSON.stringify({
            action: "search",
            query: "Re:Zero ED",
            scope: "moegirl",
            engine: "bing"
          })
        }
      ],
      toolResults: [
        {
          name: "agent-tool-web-browser",
          callID: "web-call-1",
          output: JSON.stringify({
            title: "Re:Zero ED - 搜索结果",
            url: "https://www.bing.com/search?q=Re%3AZero+ED",
            linkCount: 8,
            contentChars: 12000,
            search: {
              scope: "moegirl",
              label: "萌娘百科",
              domains: ["zh.moegirl.org.cn"]
            },
            results: [
              {
                title: "STYX HELIX",
                url: "https://zh.moegirl.org.cn/STYX_HELIX",
                domain: "zh.moegirl.org.cn",
                snippet: "电视动画《Re:从零开始的异世界生活》片尾曲"
              },
              {
                title: "Stay Alive",
                url: "https://zh.moegirl.org.cn/Stay_Alive",
                domain: "zh.moegirl.org.cn",
                snippet: "第二首片尾曲"
              }
            ]
          })
        }
      ]
    };

    render(<ToolStep item={item} autoCollapse={false} />);

    expect(getStepDisclosure(/浏览网页/)).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("萌娘百科 · zh.moegirl.org.cn")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "网页来源" })).toHaveTextContent("STYX HELIX");
    expect(screen.getByRole("list", { name: "网页来源" })).toHaveTextContent("Stay Alive");
  });

  it("在网页正文卡片中显示作者和发布日期", () => {
    const item: AgentToolTimelineItem = {
      id: "web-open-1",
      type: "tool",
      status: "done",
      toolCalls: [
        {
          name: "agent-tool-web-browser",
          callID: "web-open-call-1",
          arguments: JSON.stringify({
            action: "open",
            url: "https://music.example.com/interview"
          })
        }
      ],
      toolResults: [
        {
          name: "agent-tool-web-browser",
          callID: "web-open-call-1",
          output: JSON.stringify({
            title: "制作人访谈",
            url: "https://music.example.com/interview",
            author: "音乐编辑部",
            publishedAt: "2026-07-24T23:30:00-07:00",
            contentChars: 3200,
            contentRange: {
              start: 0,
              end: 3200,
              total: 9100,
              hasMore: true,
              nextCursor: 3200
            }
          })
        }
      ]
    };

    render(<ToolStep item={item} />);

    fireEvent.click(getStepDisclosure(/浏览网页/));

    expect(screen.getByText(/作者 音乐编辑部/)).toBeInTheDocument();
    expect(screen.getByText(/2026年7月24日/)).toBeInTheDocument();
    expect(screen.getByText("已读取 0–3,200 / 9,100 字符")).toBeInTheDocument();
    expect(screen.getByText("可从 3,200 继续读取")).toBeInTheDocument();
  });
});
