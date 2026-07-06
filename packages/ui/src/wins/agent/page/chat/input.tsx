import { Cpu, Plus, Square, RefreshCw, SendHorizontal } from "lucide-react";
import { memo, useId, useRef, type FC, useState, type FormEvent, type KeyboardEvent } from "react";
import IconButton from "@/common/components/data-input/icon-button";
import type { AIProviderConfigSnapshot } from "@mahiru/ai";

interface ChatInputProps {
  sending?: boolean;
  runningRunID: string;
  loadingConfigs?: boolean;
  selectedConfigID: string;
  selectedConversationID: string;
  configs: AIProviderConfigSnapshot[];
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onAbort: NormalFunc;
  onCreateConfig: NormalFunc;
  onRefreshConfigs: NormalFunc;
  onSelectConfig: NormalFunc<[id: string]>;
  onSubmit: NormalFunc<[text: string], Promise<boolean>>;
}

const ChatInput: FC<ChatInputProps> = ({
  onAbort,
  onSubmit,
  onCreateConfig,
  onSelectConfig,
  onRefreshConfigs,
  configs,
  sending,
  activeConfig,
  runningRunID,
  loadingConfigs,
  selectedConfigID,
  selectedConversationID
}) => {
  const selectID = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState("");
  const disabled =
    sending || !input.trim() || !activeConfig || !selectedConversationID || !!runningRunID;
  const placeholder = !activeConfig
    ? "先创建或选择模型配置"
    : !selectedConversationID
      ? "先创建或选择一个对话"
      : "输入消息";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (disabled || !text) return;

    const accepted = await onSubmit(text);
    if (accepted) setInput("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  return (
    <footer className="shrink-0 border-t border-white/8 bg-black/12 px-5 py-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[52rem] gap-2.5">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2" htmlFor={selectID}>
            <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-white/56">
              <Cpu className="size-3.5" />
              模型
            </span>
            <select
              id={selectID}
              className="
                h-8 min-w-0 flex-1 rounded-lg border border-white/14 bg-white/9
                px-2.5 text-[12px] font-semibold outline-none transition-colors
                duration-200 focus:border-primary/70 focus:bg-white/14
                disabled:pointer-events-none disabled:opacity-45
              "
              value={selectedConfigID}
              disabled={!!runningRunID}
              onChange={(event) => onSelectConfig(event.target.value)}>
              <option value="">选择模型配置</option>
              {configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name} · {config.config.model}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-0 items-center gap-1">
            {activeConfig && (
              <span className="max-w-44 truncate rounded-lg border border-white/10 bg-black/16 px-2 py-1 text-[11px] text-white/48">
                {activeConfig.provider}
              </span>
            )}
            <IconButton
              label="刷新模型配置"
              size="compact"
              icon={RefreshCw}
              disabled={loadingConfigs}
              onClick={onRefreshConfigs}
            />
            <IconButton icon={Plus} label="创建模型配置" size="compact" onClick={onCreateConfig} />
          </div>
        </div>
        <form ref={formRef} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={submit}>
          <textarea
            className="
              max-h-36 min-h-14 resize-none rounded-xl border border-white/12
              bg-black/24 px-3.5 py-2.5 text-[13px] leading-5 outline-none
              transition-colors duration-200 placeholder:text-white/35
              focus:border-primary/70 focus:bg-black/30
            "
            value={input}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="flex items-end gap-1">
            <IconButton
              label="停止生成"
              icon={Square}
              size="normal"
              show={!!runningRunID}
              onClick={onAbort}
            />
            <button
              className="
                inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl
                bg-primary text-primary-text transition-colors duration-200 hover:opacity-85
                disabled:pointer-events-none disabled:opacity-35
              "
              title="发送消息"
              type="submit"
              aria-label="发送消息"
              disabled={disabled}>
              <SendHorizontal className="size-5" />
            </button>
          </div>
        </form>
      </div>
    </footer>
  );
};

export default memo(ChatInput);
