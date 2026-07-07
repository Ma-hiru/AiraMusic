import { Cpu, Plus, Square, SendHorizontal } from "lucide-react";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import IconButton from "@/common/components/data-input/icon-button";
import CompactSelect from "@/common/components/data-input/compact-select";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState("");
  const configOptions = useMemo(
    () =>
      configs.map((config) => ({
        value: config.id,
        label: `${config.name} · ${config.config.model}`,
        title: `${config.name} · ${config.config.model}`,
        description: config.provider
      })),
    [configs]
  );
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
      <form
        ref={formRef}
        className="
          mx-auto grid max-w-208 gap-2 rounded-2xl border border-white/12
          bg-black/22 p-2.5 shadow-xl shadow-black/12
        "
        onSubmit={submit}>
        <textarea
          className="
            max-h-36 min-h-15 resize-none rounded-xl border border-transparent
            bg-transparent px-2.5 py-2 text-[13px] leading-5 outline-none
            transition-colors duration-200 placeholder:text-white/35
            focus:border-white/10 focus:bg-white/4 scrollbar scrollbar-show
          "
          value={input}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onChange={(event) => setInput(event.target.value)}
        />
        <div className="flex min-h-8 min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <CompactSelect
              className="max-w-84"
              icon={Cpu}
              label="选择模型配置"
              placement="top"
              placeholder="选择模型"
              options={configOptions}
              value={selectedConfigID}
              disabled={!!runningRunID}
              onChange={onSelectConfig}
              onOpen={() => {
                if (!loadingConfigs) onRefreshConfigs();
              }}
              renderFooter={(close) => (
                <button
                  className="
                    flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2
                    text-left text-[12px] font-semibold text-white/72 outline-none
                    transition-colors duration-200 hover:bg-white/10 focus-visible:ring-2
                    focus-visible:ring-white/45
                  "
                  type="button"
                  onClick={() => {
                    close();
                    onCreateConfig();
                  }}>
                  <Plus className="size-3.5 shrink-0 text-white/48" />
                  <span className="min-w-0 truncate">新增模型配置</span>
                </button>
              )}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              label="停止生成"
              icon={Square}
              size="compact"
              show={!!runningRunID}
              onClick={onAbort}
            />
            <button
              className="
                inline-flex size-9 cursor-pointer items-center justify-center rounded-xl
                bg-primary text-primary-text transition-colors duration-200 hover:opacity-85
                disabled:pointer-events-none disabled:opacity-35
              "
              title="发送消息"
              type="submit"
              aria-label="发送消息"
              disabled={disabled}>
              <SendHorizontal className="size-4.5" />
            </button>
          </div>
        </div>
      </form>
    </footer>
  );
};

export default memo(ChatInput);
