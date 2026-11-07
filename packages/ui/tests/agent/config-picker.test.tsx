import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ConfigPicker from "@mahiru/ui/wins/agent/page/chat/config-picker";
import type { ProviderConfigView } from "@mahiru/agent/browser";

const config: ProviderConfigView = {
  id: "ollama-config",
  name: "本地模型",
  provider: "ollama",
  model: "qwen3:8b",
  contextSize: "256K",
  maskedApiKey: "",
  default: true,
  thinking: false
};

afterEach(cleanup);

it("从配置列表删除指定配置，关闭选择器且不切换配置", () => {
  const onRemove = vi.fn();
  const onSelect = vi.fn();
  render(
    <ConfigPicker
      configs={[config]}
      activeConfig={config}
      selectedConfigID={config.id}
      onEdit={vi.fn()}
      onCreate={vi.fn()}
      onRefresh={vi.fn()}
      onRemove={onRemove}
      onSelect={onSelect}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "模型配置" }));
  fireEvent.click(screen.getByRole("button", { name: "删除 本地模型" }));
  expect(onRemove).toHaveBeenCalledExactlyOnceWith(config);
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "选择模型配置" })).not.toBeInTheDocument();
});
