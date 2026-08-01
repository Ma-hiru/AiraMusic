import { X, Square, PencilLine, SendHorizontal } from "lucide-react";
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
import type { AIProviderConfigSnapshot } from "@mahiru/ai";
import type { AgentRetryCandidate } from "@/wins/agent/hooks/use-conversation";

interface ChatInputProps {
  sending?: boolean;
  runningRunID: string;
  runningLabel?: string;
  selectedConversationID: string;
  retryCandidate: Nullable<AgentRetryCandidate>;
  activeConfig: Undefinable<AIProviderConfigSnapshot>;
  onAbort: NormalFunc;
  onSubmit: NormalFunc<[text: string], Promise<boolean>>;
  onRetry: NormalFunc<[text: string, abortedRunID: string], Promise<boolean>>;
}

const ChatInput: FC<ChatInputProps> = ({
  onAbort,
  onRetry,
  onSubmit,
  sending,
  activeConfig,
  runningLabel,
  runningRunID,
  retryCandidate,
  selectedConversationID
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardHintID = useId();
  useScrollAutoHide(textareaRef, 700);
  const [input, setInput] = useState("");
  const [editingRunID, setEditingRunID] = useState("");
  const autoEditedRunIDRef = useRef("");
  const draftBeforeRetryRef = useRef("");
  const resizeInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 112)}px`;
  }, []);
  useEffect(resizeInput, [input, resizeInput]);
  const activateRetryEdit = useCallback(
    (focus = true) => {
      if (!retryCandidate) return;
      if (editingRunID !== retryCandidate.runID) {
        draftBeforeRetryRef.current = input;
      }
      setInput(retryCandidate.text);
      setEditingRunID(retryCandidate.runID);
      if (!focus) return;
      queueMicrotask(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          retryCandidate.text.length,
          retryCandidate.text.length
        );
      });
    },
    [editingRunID, input, retryCandidate]
  );
  useEffect(() => {
    if (!retryCandidate) return;
    if (autoEditedRunIDRef.current === retryCandidate.runID) return;
    autoEditedRunIDRef.current = retryCandidate.runID;
    if (!input.trim()) activateRetryEdit(false);
  }, [activateRetryEdit, input, retryCandidate]);
  useEffect(() => {
    if (retryCandidate || !editingRunID) return;
    setInput(draftBeforeRetryRef.current);
    draftBeforeRetryRef.current = "";
    setEditingRunID("");
  }, [editingRunID, retryCandidate]);
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

    const retryRunID = retryCandidate?.runID === editingRunID ? editingRunID : "";
    const accepted = retryRunID ? await onRetry(text, retryRunID) : await onSubmit(text);
    if (accepted) {
      // IPC 等待期间允许继续起草下一条消息，不能用旧请求的完成事件把新草稿清空。
      setInput((current) => (current === submittedInput ? "" : current));
      setEditingRunID("");
      draftBeforeRetryRef.current = "";
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
  const cancelRetryEdit = () => {
    setInput(draftBeforeRetryRef.current);
    draftBeforeRetryRef.current = "";
    setEditingRunID("");
    textareaRef.current?.focus();
  };
  const editingRetry = !!retryCandidate && editingRunID === retryCandidate.runID;

  return (
    <footer className="shrink-0 px-3 pt-1 pb-2.5 sm:px-4">
      <div className="mx-auto max-w-200">
        {runningRunID && (
          <div className="agent-working mb-0.5" role="status">
            <span className="agent-working-dot" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{runningLabel || "正在生成回复"}</span>
          </div>
        )}
        {retryCandidate && !runningRunID && (
          <div className="mb-1 flex min-h-7 items-center gap-2 px-1 text-[10px]" aria-live="polite">
            {editingRetry ? (
              <>
                <PencilLine className="size-3 shrink-0 text-amber-100/58" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-white/45">
                  正在编辑已停止的消息，发送后会替换原来的未完成回复
                </span>
                <button
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/34 outline-none transition-colors hover:bg-white/7 hover:text-white/64 focus-visible:ring-2 focus-visible:ring-white/35"
                  title="取消编辑"
                  type="button"
                  aria-label="取消编辑已停止的消息"
                  onClick={cancelRetryEdit}>
                  <X className="size-3" />
                </button>
              </>
            ) : (
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-amber-100/52 outline-none transition-colors hover:bg-white/5 hover:text-amber-50/78 focus-visible:ring-2 focus-visible:ring-white/35"
                type="button"
                onClick={() => activateRetryEdit()}>
                <PencilLine className="size-3" aria-hidden="true" />
                编辑已停止的消息并重新生成
              </button>
            )}
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
                disabled={disabled}
                aria-label={editingRetry ? "重新生成" : "发送消息"}
                title={
                  editingRetry ? "替换已停止的消息并重新生成" : "发送消息 · Shift + Enter 换行"
                }>
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
