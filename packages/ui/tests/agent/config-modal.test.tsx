import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { createAgentConfigModal } from "@mahiru/ui/wins/agent/page/config-modal";
import type { ProviderConfigView, ProviderDescriptor } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  showToast: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn()
}));

vi.mock("@/wins/agent/lib/agent", () => ({
  RendererAgent: { createConfig: mocks.createConfig, updateConfig: mocks.updateConfig }
}));
vi.mock("@/common/components/display/modal", () => ({ default: { close: mocks.close } }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: mocks.showToast } }));

const provider: ProviderDescriptor = {
  id: "openai",
  label: "OpenAI Compatible",
  description: "兼容接口",
  configSchema: {
    type: "object",
    required: ["model", "apiKey"],
    properties: {
      model: { type: "string", title: "模型", description: "填写模型 ID" },
      baseUrl: { type: "string", title: "Base URL" },
      contextSize: {
        type: "string",
        title: "上下文窗口",
        default: "128K",
        description: "例如 128K、256K、1M"
      },
      thinking: { type: "boolean", title: "思考模式", default: false },
      apiKey: { type: "string", title: "API Key", format: "password", writeOnly: true }
    }
  }
};

const config: ProviderConfigView = {
  id: "config-1",
  name: "测试配置",
  provider: "openai",
  model: "test-model",
  maskedApiKey: "••••",
  contextSize: "256K",
  baseUrl: "http://127.0.0.1:12345/v1",
  default: true,
  thinking: true
};

const ollamaProvider: ProviderDescriptor = {
  id: "ollama",
  label: "Ollama",
  description: "Ollama 的 OpenAI 兼容接口",
  configSchema: {
    type: "object",
    required: ["model"],
    properties: {
      model: { type: "string", title: "模型" },
      baseUrl: { type: "string", title: "Base URL", default: "http://localhost:11434/v1" },
      contextSize: { type: "string", title: "上下文窗口", default: "128K" },
      thinking: {
        type: "boolean",
        title: "思考模式",
        default: false,
        description: "需要模型支持；部分模型只支持调整思考强度"
      },
      apiKey: { type: "string", title: "API Key", format: "password", writeOnly: true }
    }
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConfig.mockResolvedValue({ ok: true, data: config });
  mocks.updateConfig.mockResolvedValue({ ok: true, data: config });
});

afterEach(cleanup);

describe("Agent 模型配置弹窗", () => {
  it("四组都有独立卡片和标题图标，高级字段直接可见", () => {
    render(createAgentConfigModal({ providers: [provider], onSaved: vi.fn() }).content);

    for (const name of ["基础信息", "模型与接口", "访问凭据", "高级设置"]) {
      expect(screen.getByRole("region", { name }).querySelector("svg")).not.toBeNull();
    }
    expect(screen.getByRole("switch", { name: "思考模式" })).toBeVisible();
    expect(screen.getByRole("switch", { name: "思考模式" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("新建时按 schema 校验必填字段并保存高级字段", async () => {
    const onSaved = vi.fn();
    render(createAgentConfigModal({ providers: [provider], onSaved }).content);
    const save = screen.getByRole("button", { name: "添加配置" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("输入模型"), { target: { value: "new-model" } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("输入API Key"), {
      target: { value: "test-api-key" }
    });
    fireEvent.change(screen.getByDisplayValue("128K"), { target: { value: "1M" } });
    fireEvent.click(screen.getByRole("switch", { name: "思考模式" }));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(mocks.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "new-model",
          apiKey: "test-api-key",
          contextSize: "1M",
          thinking: true
        })
      )
    );
    expect(onSaved).toHaveBeenCalledWith(config);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("编辑时锁定 Provider，密钥留空仍可保存并保持原有配置", async () => {
    const onSaved = vi.fn();
    render(
      createAgentConfigModal({ providers: [provider], initialConfig: config, onSaved }).content
    );
    expect(screen.getByRole("button", { name: "Provider" })).toBeDisabled();
    const key = screen.getByPlaceholderText("留空保留当前密钥");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveValue("");
    const save = screen.getByRole("button", { name: "保存更改" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(mocks.updateConfig).toHaveBeenCalledWith({
        id: config.id,
        config: {
          name: config.name,
          provider: config.provider,
          model: config.model,
          apiKey: "",
          contextSize: config.contextSize,
          baseUrl: config.baseUrl,
          default: config.default,
          thinking: config.thinking
        }
      })
    );
    expect(onSaved).toHaveBeenCalledWith(config);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("切换 Ollama 时采用服务端 schema 的默认地址，允许不填写可选密钥", async () => {
    render(
      createAgentConfigModal({ providers: [provider, ollamaProvider], onSaved: vi.fn() }).content
    );
    fireEvent.click(screen.getByRole("button", { name: "Provider" }));
    fireEvent.click(screen.getByRole("option", { name: /^Ollama/ }));
    expect(screen.getByDisplayValue("http://localhost:11434/v1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入API Key")).toHaveAttribute("aria-required", "false");
    fireEvent.change(screen.getByPlaceholderText("输入模型"), { target: { value: "qwen3:8b" } });
    expect(screen.getByText("需要模型支持；部分模型只支持调整思考强度")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "添加配置" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(mocks.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "ollama",
          model: "qwen3:8b",
          apiKey: "",
          baseUrl: "http://localhost:11434/v1"
        })
      )
    );
  });

  it("编辑无密钥的本地配置时不声称已保存密钥", () => {
    render(
      createAgentConfigModal({
        providers: [provider, ollamaProvider],
        initialConfig: { ...config, provider: "ollama", maskedApiKey: "" },
        onSaved: vi.fn()
      }).content
    );
    expect(screen.queryByText("密钥已经安全保存；留空不会修改")).not.toBeInTheDocument();
    expect(screen.getByText("本地服务可留空；远程服务需要鉴权时填写")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存更改" })).toBeEnabled();
  });
});
