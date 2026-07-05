import { cx } from "@emotion/css";
import { Check, KeyRound } from "lucide-react";
import { type FC, useState, type FormEvent } from "react";
import { RendererAgent } from "@/wins/agent/lib/agent";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";
import type {
  LLMProviderOpenAIConfig,
  AIProviderConfigSnapshot,
  LLMProviderOpenAIAPIMode
} from "@mahiru/ai";

type AgentConfigForm = {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseURL: string;
  provider: string;
  apiMode: LLMProviderOpenAIAPIMode;
};

type AgentConfigModalProps = {
  providers: string[];
  defaultProvider?: string;
  onCreated: NormalFunc<[config: AIProviderConfigSnapshot]>;
};

const inputClassName = `
  h-9 rounded-md border border-white/15 bg-white/10 px-3 text-[13px]
  outline-none transition-colors placeholder:text-white/35
  focus:border-primary focus:bg-white/15
`;

const createDefaultForm = (provider = ""): AgentConfigForm => ({
  id: "",
  provider,
  apiMode: "chat_completions",
  name: "DeepSeek",
  model: "deepseek-chat",
  baseURL: "https://api.deepseek.com",
  apiKey: ""
});

export function createAgentConfigModal(props: AgentConfigModalProps): ModalRender {
  return {
    width: 520,
    title: "创建 Agent 配置",
    subTitle: "Provider Config",
    content: <AgentConfigFormContent {...props} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const AgentConfigFormContent: FC<AgentConfigModalProps> = ({
  onCreated,
  providers,
  defaultProvider
}) => {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => createDefaultForm(defaultProvider ?? providers[0]));

  const disabled =
    creating || !form.provider || !form.name.trim() || !form.model.trim() || !form.apiKey.trim();

  const createConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    setCreating(true);
    try {
      const baseURL = form.baseURL.trim();
      const providerConfig: LLMProviderOpenAIConfig = {
        model: form.model.trim(),
        apiKey: form.apiKey.trim(),
        apiMode: form.apiMode,
        ...(baseURL ? { baseURL } : {})
      };
      const result = await RendererAgent.createConfig({
        id: form.id.trim() || undefined,
        name: form.name.trim(),
        provider: form.provider,
        config: providerConfig
      });
      if (!result.ok) {
        AppToast.show({ type: "error", text: result.reason.message });
        return;
      }

      onCreated(result.data);
      AppToast.show({ type: "success", text: "配置已创建" });
      AppModal.close();
    } finally {
      setCreating(false);
    }
  };

  return (
    <form className="grid gap-4 text-[13px]" onSubmit={createConfig}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1 font-medium text-white/70">
          Provider
          <select
            className={inputClassName}
            value={form.provider}
            disabled={!providers.length}
            onChange={(event) =>
              setForm((current) => ({ ...current, provider: event.target.value }))
            }>
            {providers.length ? (
              providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))
            ) : (
              <option value="">暂无 Provider</option>
            )}
          </select>
        </label>
        <label className="grid gap-1 font-medium text-white/70">
          API Mode
          <select
            className={inputClassName}
            value={form.apiMode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                apiMode: event.target.value as LLMProviderOpenAIAPIMode
              }))
            }>
            <option value="chat_completions">Chat Completions</option>
            <option value="responses">Responses</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 font-medium text-white/70">
          名称
          <input
            className={inputClassName}
            value={form.name}
            placeholder="例如 DeepSeek"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoFocus
          />
        </label>
        <label className="grid gap-1 font-medium text-white/70">
          Model
          <input
            className={inputClassName}
            value={form.model}
            placeholder="deepseek-chat"
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 font-medium text-white/70">
          Base URL
          <input
            className={inputClassName}
            value={form.baseURL}
            placeholder="https://api.deepseek.com"
            onChange={(event) =>
              setForm((current) => ({ ...current, baseURL: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-1 font-medium text-white/70">
          API Key
          <input
            className={inputClassName}
            type="password"
            value={form.apiKey}
            placeholder="sk-..."
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 font-medium text-white/70">
          Config ID
          <input
            className={inputClassName}
            value={form.id}
            placeholder="留空自动生成"
            onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-white/45">
          <KeyRound className="size-4 shrink-0" />
          <span className="truncate">密钥由主进程安全存储，列表中只显示脱敏值。</span>
        </div>
        <button
          className={cx(
            `
              inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md
              px-3 font-semibold transition-all active:scale-96
              disabled:pointer-events-none disabled:opacity-40
            `,
            disabled ? "bg-white/10 text-white/50" : "bg-primary text-primary-text hover:opacity-85"
          )}
          type="submit"
          disabled={disabled}>
          <Check className="size-4" />
          {creating ? "创建中..." : "创建"}
        </button>
      </div>
    </form>
  );
};
