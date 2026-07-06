import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, CheckCircle2, ChevronRight, LoaderCircle } from "lucide-react";

import type { AgentToolTimelineItem } from "../types";

interface ToolStepProps {
  item: AgentToolTimelineItem;
}

const ToolStep: FC<ToolStepProps> = ({ item }) => {
  const [open, setOpen] = useState(item.status === "running");
  const title = useMemo(() => {
    const names = item.toolCalls.length
      ? item.toolCalls.map((call) => call.name)
      : item.toolResults.map((result) => result.name);
    return Array.from(new Set(names)).join("、") || "工具调用";
  }, [item.toolCalls, item.toolResults]);
  const total = Math.max(item.toolCalls.length, item.toolResults.length);

  return (
    <section className="min-w-0 max-w-[min(100%,48rem)] overflow-hidden rounded-2xl border border-white/9 bg-black/16 text-[12px] text-white/68 shadow-sm shadow-black/10">
      <button
        className="
          flex min-h-10 w-full cursor-pointer items-center gap-2 px-3.5 py-2.5
          text-left outline-none transition-colors duration-200 hover:bg-white/7
          focus-visible:ring-2 focus-visible:ring-white/50
        "
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        {open ? (
          <ChevronDown className="size-4 shrink-0 opacity-65" />
        ) : (
          <ChevronRight className="size-4 shrink-0 opacity-65" />
        )}
        <StatusIcon status={item.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white/78">{getStatusText(item.status)}</div>
          <div className="truncate text-[11px] opacity-55">
            {title}
            {total > 1 ? ` · ${total} 项` : ""}
          </div>
        </div>
        {typeof item.step === "number" && (
          <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] opacity-50">
            step {item.step + 1}
          </span>
        )}
      </button>

      {open && (
        <div className="grid min-w-0 gap-2 border-t border-white/9 bg-black/8 p-2.5">
          {item.toolCalls.length
            ? item.toolCalls.map((call) => (
                <ToolCallDetail
                  key={call.callID}
                  name={call.name}
                  callID={call.callID}
                  input={call.arguments}
                  output={item.toolResults.find((result) => result.callID === call.callID)?.output}
                />
              ))
            : item.toolResults.map((result) => (
                <ToolCallDetail
                  key={result.callID}
                  name={result.name}
                  callID={result.callID}
                  output={result.output}
                />
              ))}
        </div>
      )}
    </section>
  );
};

const ToolCallDetail: FC<{
  name: string;
  callID: string;
  input?: string;
  output?: string;
}> = memo(({ name, input, callID, output }) => {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/7">
      <header className="flex min-w-0 items-center justify-between gap-2 border-b border-white/8 px-2.5 py-1.5">
        <span className="min-w-0 truncate font-semibold text-white/75">{name}</span>
        <span className="max-w-40 shrink-0 truncate text-[10px] opacity-35">{callID}</span>
      </header>
      <div className="grid min-w-0 gap-2 p-2">
        {input && <CodeBlock label="输入" value={input} />}
        {output && <CodeBlock label="结果" value={output} />}
        {!output && (
          <div className="flex items-center gap-2 rounded-md bg-black/15 px-2 py-1.5 text-[11px] opacity-55">
            <LoaderCircle className="size-3.5 animate-spin" />
            等待结果
          </div>
        )}
      </div>
    </article>
  );
});

const CodeBlock: FC<{ label: string; value: string }> = memo(({ label, value }) => (
  <div className="min-w-0">
    <div className="mb-1 text-[10px] font-semibold uppercase opacity-45">{label}</div>
    <pre
      className="
        max-h-52 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-lg
        bg-black/28 p-2.5 text-[11px] leading-4 text-white/64 scrollbar scrollbar-show
      ">
      {value}
    </pre>
  </div>
));

const StatusIcon: FC<{ status: AgentToolTimelineItem["status"] }> = ({ status }) => {
  if (status === "running") {
    return <LoaderCircle className="size-4 shrink-0 animate-spin text-sky-200/80" />;
  }
  if (status === "error") {
    return <AlertCircle className="size-4 shrink-0 text-red-200/80" />;
  }
  return (
    <span
      className={cx(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        "text-emerald-200/80"
      )}>
      <CheckCircle2 className="size-4" />
    </span>
  );
};

const getStatusText = (status: AgentToolTimelineItem["status"]) => {
  if (status === "running") return "正在使用工具";
  if (status === "error") return "工具调用已停止";
  return "已使用工具";
};

export default memo(ToolStep);
