import { Square, SendHorizontal } from "lucide-react";
import {
  memo,
  useId,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import type { ProviderConfigView } from "@mahiru/agent/browser";

interface ChatInputProps {
  sending?: boolean;
  runningRunID: string;
  runningLabel?: string;
  selectedConversationID: string;
  activeConfig: Undefinable<ProviderConfigView>;
  onAbort: NormalFunc;
  onSubmit: NormalFunc<[text: string], Promise<boolean>>;
}

const ChatInput: FC<ChatInputProps> = ({
  onAbort,
  onSubmit,
  sending,
  activeConfig,
  runningLabel,
  runningRunID,
  selectedConversationID
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardHintID = useId();
  useScrollAutoHide(textareaRef, 700);
  const [input, setInput] = useState("");
  const resizeInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 112)}px`;
  }, []);
  useEffect(resizeInput, [input, resizeInput]);
  const disabled =
    sending || !input.trim() || !activeConfig || !selectedConversationID || !!runningRunID;
  const placeholder = !activeConfig
    ? "先创建或选择模型配置"
    : !selectedConversationID
      ? "先创建或选择一个对话"
      : "输入消息";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedInput = input;
    const text = submittedInput.trim();
    if (disabled || !text) return;

    const accepted = await onSubmit(text);
    if (accepted) {
      // IPC 等待期间允许继续起草下一条消息，不能用旧请求的完成事件把新草稿清空。
      setInput((current) => (current === submittedInput ? "" : current));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    formRef.current?.requestSubmit();
  };
  return (
    <footer className="shrink-0 px-3 pt-1 pb-2.5 sm:px-4">
      <div className="mx-auto max-w-200">
        {runningRunID && (
          <div className="agent-working mb-0.5" role="status">
            <span className="agent-working-dot" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{runningLabel || "正在生成回复"}</span>
          </div>
        )}
        <form
          ref={formRef}
          className="
            rounded-2xl border border-white/12 bg-black/28 p-1.5
            backdrop-blur-xl transition-colors duration-200
            focus-within:border-white/22
          "
          onSubmit={submit}>
          <div className="flex items-end gap-1.5">
            <textarea
              ref={textareaRef}
              className="
                agent-scroll max-h-28 min-h-9 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-transparent
                bg-transparent px-2.5 py-1.5 text-[13px] leading-5 outline-none
                transition-colors duration-200 placeholder:text-white/32
              "
              rows={1}
              value={input}
              placeholder={placeholder}
              aria-describedby={keyboardHintID}
              onKeyDown={onKeyDown}
              onChange={(event) => setInput(event.target.value)}
            />
            <span id={keyboardHintID} className="sr-only">
              Enter 发送，Shift + Enter 换行
            </span>
            {runningRunID ? (
              <button
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-red-200/18 bg-red-200/10 text-red-100/78 outline-none transition-colors hover:bg-red-200/16 focus-visible:ring-2 focus-visible:ring-red-100/40"
                title="停止生成"
                type="button"
                aria-label="停止生成"
                onClick={onAbort}>
                <Square className="size-3" />
              </button>
            ) : (
              <button
                className="
                  inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full
                  bg-primary text-primary-text
                  transition-opacity duration-200 hover:opacity-85 disabled:pointer-events-none
                  disabled:opacity-35
                "
                type="submit"
                aria-label="发送消息"
                disabled={disabled}
                title="发送消息 · Shift + Enter 换行">
                <SendHorizontal className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between px-2.5 pt-1 pb-0.5 text-[8.5px] text-white/24">
            <span className="truncate">
              {activeConfig ? `${activeConfig.name} · Aira 可能出错，请注意核实` : "未接入模型"}
            </span>
            <span className="hidden shrink-0 sm:block">Enter 发送 · Shift + Enter 换行</span>
          </div>
        </form>
      </div>
    </footer>
  );
};

export default memo(ChatInput);
