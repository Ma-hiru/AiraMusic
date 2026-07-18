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
  it("keeps running and completed results open by default", () => {
    const { rerender } = render(<ToolStep item={createItem("running")} />);
    const disclosure = getStepDisclosure(/读取歌曲详情/);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ToolStep
        item={createItem(
          "done",
          JSON.stringify({ name: "夜に駆ける", artists: [{ name: "YOASOBI" }] })
        )}
      />
    );

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("夜に駆ける")).toBeInTheDocument();
  });

  it("opens an already completed result by default", () => {
    render(
      <ToolStep
        item={createItem("done", JSON.stringify({ name: "群青", artists: [{ name: "YOASOBI" }] }))}
      />
    );

    const disclosure = getStepDisclosure(/读取歌曲详情/);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    const controlledRegion = document.getElementById(disclosure.getAttribute("aria-controls")!);
    expect(controlledRegion).toBeInTheDocument();
    expect(controlledRegion).not.toHaveAttribute("hidden");
    expect(screen.getByText("群青")).toBeInTheDocument();
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

  it("does not override the user's disclosure choice when status changes", () => {
    const { rerender } = render(
      <ToolStep item={createItem("done", JSON.stringify({ name: "夜に駆ける" }))} />
    );
    const disclosure = getStepDisclosure(/读取歌曲详情/);

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    rerender(<ToolStep item={createItem("running", undefined)} />);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ToolStep
        item={createItem(
          "error",
          JSON.stringify({ error: { type: "timeout", message: "读取超时" } })
        )}
      />
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    rerender(<ToolStep item={createItem("done", JSON.stringify({ ok: true }))} />);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps raw input and output behind a second disclosure", () => {
    render(
      <ToolStep
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

    render(<ToolStep item={item} />);
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

    render(<ToolStep item={item} />);

    expect(getStepDisclosure(/浏览网页/)).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("萌娘百科 · zh.moegirl.org.cn")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "网页来源" })).toHaveTextContent("STYX HELIX");
    expect(screen.getByRole("list", { name: "网页来源" })).toHaveTextContent("Stay Alive");
  });
});
