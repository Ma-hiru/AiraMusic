import { Square, SendHorizontal } from "lucide-react";
import {
  memo,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import type { AIProviderConfigSnapshot } from "@mahiru/ai";

interface ChatInputProps {
  sending?: boolean;
  runningRunID: string;
  selectedConversationID: string;
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onAbort: NormalFunc;
  onSubmit: NormalFunc<[text: string], Promise<boolean>>;
}

const ChatInput: FC<ChatInputProps> = ({
  onAbort,
  onSubmit,
  sending,
  activeConfig,
  runningRunID,
  selectedConversationID
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    <footer className="shrink-0 border-t border-white/6 bg-black/12 px-3 py-2 backdrop-blur-xl sm:px-4">
      <form
        ref={formRef}
        className="
          mx-auto flex max-w-200 items-end gap-1.5 rounded-xl border border-white/11
          bg-black/24 p-1.5 shadow-lg shadow-black/12 ring-1 ring-black/8
        "
        onSubmit={submit}>
        <textarea
          ref={textareaRef}
          className="
            agent-scroll max-h-28 min-h-9 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-transparent
            bg-transparent px-2 py-1.5 text-[13px] leading-5 outline-none
            transition-colors duration-200 placeholder:text-white/35
            focus:border-white/8 focus:bg-white/[0.025]
          "
          rows={1}
          value={input}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onChange={(event) => setInput(event.target.value)}
        />
        <span className="sr-only">Enter 发送，Shift + Enter 换行</span>
        {runningRunID ? (
          <button
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/9 bg-white/5 text-white/54 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
            title="停止生成"
            type="button"
            aria-label="停止生成"
            onClick={onAbort}>
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            className="
              inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg
              bg-primary text-primary-text transition-colors duration-200 hover:opacity-85
              disabled:pointer-events-none disabled:opacity-35
            "
            type="submit"
            aria-label="发送消息"
            disabled={disabled}
            title="发送消息 · Shift + Enter 换行">
            <SendHorizontal className="size-4" />
          </button>
        )}
      </form>
    </footer>
  );
};

export default memo(ChatInput);
