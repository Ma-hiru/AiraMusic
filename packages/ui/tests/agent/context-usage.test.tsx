import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ContextUsage from "@mahiru/ui/wins/agent/page/chat/context-usage";
import type { ProviderConfigView } from "@mahiru/agent/browser";

const config: ProviderConfigView = {
  id: "config-1",
  name: "本地模型",
  provider: "ollama",
  model: "qwen3:8b",
  contextSize: "256K",
  maskedApiKey: "",
  default: true,
  thinking: false
};

afterEach(cleanup);

it("圆环按配置容量计算占比，仅在悬停或聚焦时显示明细", () => {
  render(
    <ContextUsage
      config={config}
      running={false}
      context={{ configId: config.id, estimatedTokens: 65_536, capacityTokens: 262_144 }}
    />
  );
  const progress = screen.getByRole("progressbar", { name: "当前上下文估算" });
  expect(progress).toHaveAttribute("aria-valuenow", "25");
  expect(progress).toHaveAttribute("aria-valuemax", "100");
  expect(progress).toHaveAttribute("aria-valuetext", "65.5K / 256K · 25.0%");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.mouseEnter(progress);
  expect(screen.getByRole("tooltip")).toHaveTextContent("65.5K / 256K · 25.0%");
  expect(screen.getByText(/不含输入框草稿/)).toBeInTheDocument();
  expect(screen.getByText(/上限来自模型配置/)).toBeInTheDocument();
  fireEvent.mouseLeave(progress);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.focus(progress);
  expect(progress).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  fireEvent.keyDown(progress, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("运行期间标注快照会变化，超限时保留真实占比", () => {
  render(
    <ContextUsage
      config={config}
      context={{ configId: config.id, estimatedTokens: 300_000, capacityTokens: 262_144 }}
      running
    />
  );
  const progress = screen.getByRole("progressbar");
  fireEvent.focus(progress);
  expect(screen.getByRole("tooltip")).toHaveTextContent("生成中，显示最近同步值");
  expect(screen.getByRole("tooltip")).toHaveTextContent("114.4%");
  expect(progress).toHaveAttribute("aria-valuenow", "100");
});

it("切换配置后不沿用旧模型的容量与占比", () => {
  render(
    <ContextUsage
      running={false}
      config={{ ...config, id: "new-config", contextSize: "128K" }}
      context={{ configId: config.id, estimatedTokens: 65_536, capacityTokens: 262_144 }}
    />
  );
  fireEvent.focus(screen.getByLabelText("当前上下文估算"));
  expect(screen.getByRole("tooltip")).toHaveTextContent("65.5K Token");
  expect(screen.getByText(/下次发送时按所选配置更新上限/)).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("256K");
});

it("没有快照时显示待同步，不将缺失的用量显示为零", () => {
  render(<ContextUsage config={config} running={false} />);
  fireEvent.focus(screen.getByLabelText("当前上下文估算"));
  expect(screen.getByRole("tooltip")).toHaveTextContent("上下文用量待同步");
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("0%");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("辅助请求按会话区分标题与压缩用量，缺失报告不算零", () => {
  render(
    <ContextUsage
      config={config}
      running={false}
      auxiliaryUsage={{
        title: { requests: 1, reportedRequests: 1, promptTokens: 1_200, completionTokens: 20 },
        compaction: { requests: 2, reportedRequests: 1, promptTokens: 8_000, completionTokens: 500 }
      }}
    />
  );
  fireEvent.focus(screen.getByLabelText("当前上下文估算"));
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("本会话辅助请求");
  expect(tooltip).toHaveTextContent("标题总结1 次请求 · 1 次报告累计输入 1.2K · 输出 20 Token");
  expect(tooltip).toHaveTextContent(
    "历史压缩2 次请求 · 1 次报告 · 统计不完整已知累计输入 8K · 输出 500 Token"
  );
});

it("辅助请求尚未收到报告时只展示缺失状态，未发起的类别单独说明", () => {
  render(
    <ContextUsage
      config={config}
      running={false}
      auxiliaryUsage={{
        title: { requests: 1, reportedRequests: 0, promptTokens: 0, completionTokens: 0 },
        compaction: { requests: 0, reportedRequests: 0, promptTokens: 0, completionTokens: 0 }
      }}
    />
  );
  fireEvent.focus(screen.getByLabelText("当前上下文估算"));
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("标题总结1 次请求 · 0 次报告 · 统计不完整");
  expect(tooltip).toHaveTextContent("历史压缩尚未发起请求");
  expect(tooltip).not.toHaveTextContent("输入 0");
});

it.each([0, 262_144])("区分真实零用量和未知容量 %s", (capacityTokens) => {
  render(
    <ContextUsage
      config={config}
      running={false}
      context={{ configId: config.id, estimatedTokens: 0, capacityTokens }}
    />
  );
  fireEvent.focus(screen.getByLabelText("当前上下文估算"));
  if (capacityTokens === 0) {
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("配置容量未知");
  } else {
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("tooltip")).toHaveTextContent("0 / 256K · 0.0%");
  }
});

it("提示打开时卸载会移除浮层和窗口监听", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  try {
    const view = render(<ContextUsage config={config} running={false} />);
    fireEvent.focus(screen.getByLabelText("当前上下文估算"));
    const listeners = add.mock.calls.filter(([type]) => ["resize", "scroll"].includes(type));
    expect(listeners).toHaveLength(2);
    view.unmount();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    for (const [type, listener, capture] of listeners) {
      expect(
        remove.mock.calls.some(
          ([removedType, removedListener, removedCapture]) =>
            removedType === type && removedListener === listener && removedCapture === capture
        )
      ).toBe(true);
    }
  } finally {
    add.mockRestore();
    remove.mockRestore();
  }
});
