import { cx } from "@emotion/css";
import { Copy, Check, Sparkles } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback, type ReactNode } from "react";
import AppToast from "@/common/components/display/toast";
import type { LLMMessage } from "@mahiru/ai";
import type { AgentAssistantTurnObservability } from "@/wins/agent/page/types";

import MarkdownContent from "./markdown-content";
import { AssistantTurnMeta } from "./turn-observability";

interface ContentItemProps {
  grouped?: boolean;
  showCopy?: boolean;
  message: LLMMessage;
  streaming?: boolean;
  assistantTurn?: AgentAssistantTurnObservability;
}

interface AssistantTurnGroupProps {
  runID?: string;
  children: ReactNode;
  streaming?: boolean;
  assistantTurn?: AgentAssistantTurnObservability;
}

const AssistantTurnGroup: FC<AssistantTurnGroupProps> = ({
  runID,
  children,
  streaming,
  assistantTurn
}) => (
  <div className="flex min-w-0 justify-start">
    <article
      className={cx(
        `
          relative grid min-w-0 max-w-full grid-cols-[1.5rem_minmax(0,1fr)]
          gap-2.5 px-0.5 py-1
        `,
        streaming && "opacity-95"
      )}
      role="group"
      aria-label="Aira 的连续回复"
      data-assistant-run-id={runID}>
      <span className="mt-0.5 flex size-6 items-center justify-center rounded-lg border border-white/8 bg-white/5 text-primary">
        <Sparkles className="size-3" />
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium tracking-[0.08em] text-white/28">
          Aira
          {streaming && <span className="animate-pulse text-white/20">正在回复</span>}
        </div>
        <div className="grid min-w-0 gap-2.5">{children}</div>
        {assistantTurn && <AssistantTurnMeta turn={assistantTurn} />}
      </div>
    </article>
  </div>
);

const ContentItem: FC<ContentItemProps> = ({
  grouped,
  message,
  streaming,
  assistantTurn,
  showCopy = true
}) => {
  const isUser = message.role === "user";
  const copiedTimerRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const content = message.content ?? "";
  const copyContent = useCallback(async () => {
    if (!content) return;
    try {
      await window.navigator.clipboard.writeText(content);
      setCopied(true);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
      AppToast.show({ type: "success", text: "回复已复制" });
    } catch {
      AppToast.show({ type: "error", text: "复制失败" });
    }
  }, [content]);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  if (message.role === "tool") return null;

  if (isUser) {
    return (
      <div className="flex min-w-0 justify-end">
        <article className="min-w-0 max-w-[min(88%,36rem)] px-0.5 py-0.5">
          <div
            className="
              max-w-full whitespace-pre-wrap break-words rounded-xl rounded-br-sm border
              border-white/9 bg-white/8 px-3 py-2 text-left text-[13px]
              leading-[1.65] text-white/86 shadow-sm shadow-black/6
            ">
            {message.content}
          </div>
        </article>
      </div>
    );
  }

  const assistantContent = (
    <div className={cx("group/assistant-message relative min-w-0 pr-7", streaming && "opacity-95")}>
      <MarkdownContent content={content} streaming={streaming} />
      {showCopy && (
        <button
          className="
            absolute top-0 right-0 inline-flex size-7 cursor-pointer items-center
            justify-center rounded-lg border border-white/8 bg-black/12 text-white/42
            opacity-0 outline-none transition-all duration-200 hover:bg-white/10
            hover:text-white focus-visible:opacity-100 focus-visible:ring-2
            focus-visible:ring-white/45 group-hover/assistant-message:opacity-100
            disabled:pointer-events-none disabled:opacity-0
          "
          title="复制回复"
          type="button"
          aria-label="复制回复"
          disabled={!content}
          onClick={copyContent}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </div>
  );

  if (grouped) return assistantContent;
  return (
    <AssistantTurnGroup
      streaming={streaming}
      runID={assistantTurn?.runID}
      assistantTurn={assistantTurn}>
      {assistantContent}
    </AssistantTurnGroup>
  );
};

export { AssistantTurnGroup };

export default memo(ContentItem);
