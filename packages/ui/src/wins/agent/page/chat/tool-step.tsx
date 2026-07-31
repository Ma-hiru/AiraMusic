import { cx } from "@emotion/css";
import { memo, useId, useRef, type FC, useMemo, useState, useEffect } from "react";
import {
  Braces,
  Globe2,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  ChevronRight,
  LoaderCircle
} from "lucide-react";

import type { AgentToolTimelineItem } from "../types";
import { AssistantTurnMeta } from "./turn-observability";
import {
  isAgentToolError,
  getAgentToolSummary,
  parseAgentToolValue,
  getAgentWebToolDetails,
  getAgentToolPresentation,
  isInternalAgentToolResult,
  getAgentToolSemanticResult,
  type AgentToolSemanticResult
} from "./tool-presentation";

interface ToolStepProps {
  collapseEnabled?: boolean;
  item: AgentToolTimelineItem;
}

const ToolStep: FC<ToolStepProps> = ({ item, collapseEnabled }) => {
  const internalCallIDs = new Set(
    item.toolResults
      .filter((result) => isInternalAgentToolResult(result.output))
      .map((result) => result.callID)
  );
  if (!internalCallIDs.size) {
    return <VisibleToolStep item={item} collapseEnabled={collapseEnabled} />;
  }

  const visibleItem: AgentToolTimelineItem = {
    ...item,
    toolCalls: item.toolCalls.filter((call) => !internalCallIDs.has(call.callID)),
    toolResults: item.toolResults.filter((result) => !internalCallIDs.has(result.callID))
  };
  if (!visibleItem.toolCalls.length && !visibleItem.toolResults.length) return null;

  return <VisibleToolStep item={visibleItem} collapseEnabled={collapseEnabled} />;
};

const VisibleToolStep: FC<ToolStepProps> = ({ item, collapseEnabled }) => {
  const contentID = useAccessibleID("agent-tool-step");
  const calls = useMemo(() => {
    if (item.toolCalls.length) return item.toolCalls;
    return item.toolResults.map((result) => ({
      name: result.name,
      callID: result.callID,
      arguments: ""
    }));
  }, [item.toolCalls, item.toolResults]);
  const hasError = item.toolResults.some((result) => isAgentToolError(result.output));
  const status = hasError ? "error" : item.status;
  const canCollapse = collapseEnabled ?? status !== "running";
  const [open, setOpen] = useState(shouldAutoOpen);
  const manuallyToggledRef = useRef(false);
  const itemIDRef = useRef(item.id);
  const primary = calls[0];
  const result = primary
    ? item.toolResults.find((candidate) => candidate.callID === primary.callID)
    : undefined;
  const presentation = getAgentToolPresentation(primary?.name ?? "");
  const statusVisual = getStatusVisual(status);
  const summary = primary
    ? getAgentToolSummary({
        name: primary.name,
        input: primary.arguments,
        output: result?.output,
        running: status === "running"
      })
    : "工具调用";

  useEffect(() => {
    if (itemIDRef.current !== item.id) {
      itemIDRef.current = item.id;
      manuallyToggledRef.current = false;
    }
    if (!manuallyToggledRef.current) setOpen(shouldAutoOpen());
  }, [item.id, status]);

  const toggleOpen = () => {
    if (open && !canCollapse) return;
    manuallyToggledRef.current = true;
    setOpen((value) => !value);
  };

  return (
    <section
      className={cx(
        "relative min-w-0 max-w-[min(100%,48rem)] overflow-hidden rounded-lg border",
        "border-white/[0.075] bg-white/[0.018] text-[12px] text-white/68",
        "transition-colors duration-200 hover:border-white/10"
      )}
      data-status={status}>
      <span
        className={cx("absolute inset-y-2 left-0 w-px rounded-full", statusVisual.rail)}
        aria-hidden="true"
      />
      <button
        className={cx(
          `
            group flex h-11 w-full items-center gap-2.5 bg-transparent px-3 text-left
            outline-none transition-colors duration-150 hover:bg-white/[0.05]
            focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/45
          `,
          open && !canCollapse ? "cursor-default" : "cursor-pointer"
        )}
        type="button"
        aria-expanded={open}
        aria-controls={contentID}
        aria-disabled={open && !canCollapse}
        onClick={toggleOpen}
        title={
          open && !canCollapse ? "回复完成后可收起工具结果" : open ? "收起工具结果" : "展开工具结果"
        }>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/7 bg-white/[0.045] text-white/56 shadow-inner shadow-white/[0.025]">
          <presentation.icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="shrink-0 text-[11px] font-semibold tracking-[-0.01em] text-white/80">
            {presentation.label}
          </span>
          <span className="truncate text-[10px] text-white/40">· {summary}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {calls.length > 1 && (
            <span className="text-[9px] tabular-nums text-white/30">{calls.length} 项</span>
          )}
          <span
            className={cx(
              "hidden h-5 items-center gap-1 rounded-full border px-1.5 text-[9px] font-medium sm:flex",
              statusVisual.badge
            )}>
            <StatusIcon status={status} />
            {getStatusLabel(status)}
          </span>
          <span className="sm:hidden" aria-label={getStatusLabel(status)}>
            <StatusIcon status={status} />
          </span>
          {open && canCollapse ? (
            <ChevronDown className="size-3 text-white/30" aria-hidden="true" />
          ) : !open ? (
            <ChevronRight className="size-3 text-white/30" aria-hidden="true" />
          ) : null}
        </div>
      </button>

      <div
        id={contentID}
        className="min-w-0 border-t border-white/7 bg-black/[0.035]"
        hidden={!open}>
        {open && (
          <>
            {calls.map((call, index) => (
              <ToolCallDetail
                key={call.callID}
                status={status}
                name={call.name}
                divided={index > 0}
                ordinal={index + 1}
                callID={call.callID}
                total={calls.length}
                input={call.arguments}
                showHeading={calls.length > 1}
                output={
                  item.toolResults.find((candidate) => candidate.callID === call.callID)?.output
                }
              />
            ))}
            {item.assistantTurn && (
              <div className="border-t border-white/7 px-3 pb-2.5">
                <AssistantTurnMeta turn={item.assistantTurn} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

const ToolCallDetail: FC<{
  name: string;
  total: number;
  callID: string;
  input?: string;
  ordinal: number;
  output?: string;
  divided: boolean;
  showHeading: boolean;
  status: AgentToolTimelineItem["status"];
}> = memo(({ name, input, total, callID, output, status, divided, ordinal, showHeading }) => {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const technicalContentID = useAccessibleID("agent-tool-technical");
  const presentation = getAgentToolPresentation(name);
  const technicalLabel = `${presentation.label}技术详情${total > 1 ? `（第 ${ordinal} 项）` : ""}`;
  const web = name === "agent-tool-web-browser" ? getAgentWebToolDetails(input, output) : null;
  const semanticResult = getAgentToolSemanticResult(name, output);
  const failed = isAgentToolError(output) || (status === "error" && !output);
  const waiting = !output && status === "running";

  return (
    <article className={cx("min-w-0 px-3 py-3", divided && "border-t border-white/7")}>
      {showHeading && (
        <header className="mb-2.5 flex min-w-0 items-center gap-2">
          <presentation.icon className="size-3.5 shrink-0 text-white/42" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white/55">
            {presentation.label}
          </span>
        </header>
      )}

      {web && <WebToolSummary details={web} running={waiting} />}
      {!web && semanticResult && !failed && <SemanticToolSummary result={semanticResult} />}

      {waiting && (
        <div
          className="flex items-center gap-2 rounded-r-lg border-l border-sky-200/24 bg-sky-200/[0.025] px-3 py-2 text-[11px] text-white/45"
          role="status">
          <LoaderCircle className="size-3.5 animate-spin text-sky-100/68" aria-hidden="true" />
          正在等待结果
        </div>
      )}

      {failed && (
        <div
          className="flex items-start gap-2 rounded-r-lg border-l border-red-200/30 bg-red-200/[0.03] px-3 py-2 text-[11px] leading-5 text-red-100/72"
          role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-medium text-red-100/80">
              {semanticResult?.title || "工具没有完成这次操作"}
            </div>
            <div className="text-[10px] text-red-100/42">技术详情中保留了完整返回原因。</div>
          </div>
        </div>
      )}

      {(input || output) && (
        <div className="mt-2.5 border-t border-white/7 pt-2">
          <button
            className="group/technical flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-white/8 bg-black/10 px-2 py-1.5 text-[10px] font-medium text-white/34 outline-none transition-colors hover:border-white/13 hover:bg-white/[0.025] hover:text-white/62 focus-visible:ring-2 focus-visible:ring-white/35"
            type="button"
            aria-label={technicalLabel}
            aria-expanded={technicalOpen}
            aria-controls={technicalContentID}
            onClick={() => setTechnicalOpen((value) => !value)}>
            <Braces className="size-3" aria-hidden="true" />
            技术详情
            <span className="min-w-0 flex-1 truncate text-left text-[9px] font-normal text-white/22 transition-colors group-hover/technical:text-white/32">
              输入参数与原始返回
            </span>
            {technicalOpen ? (
              <ChevronDown className="size-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3" aria-hidden="true" />
            )}
          </button>

          <div id={technicalContentID} className="mt-2 min-w-0" hidden={!technicalOpen}>
            {technicalOpen && (
              <div className="grid min-w-0 gap-2">
                <div className="truncate font-mono text-[9px] text-white/22" title={callID}>
                  call {callID}
                </div>
                {input && <CodeBlock label="输入" value={formatTechnicalValue(input)} />}
                {output && <CodeBlock label="返回" value={formatTechnicalValue(output)} />}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
});

const SemanticToolSummary: FC<{ result: AgentToolSemanticResult }> = ({ result }) => (
  <div className="min-w-0 rounded-r-lg border-l border-emerald-200/20 bg-emerald-100/[0.022] px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[9px] font-medium tracking-[0.1em] text-emerald-100/42">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      工具结果
    </div>
    <div className="mt-1 text-[12px] leading-5 font-medium text-white/76">{result.title}</div>
    {result.description && (
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/40">
        {result.description}
      </p>
    )}
    {(result.facts.length > 0 || result.truncated) && (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] text-white/32">
        {result.facts.slice(0, 5).map((fact) => (
          <span key={fact.label}>
            {fact.label} {fact.value}
          </span>
        ))}
        {result.truncated && <span>长内容已裁剪</span>}
      </div>
    )}
    {result.items.length > 0 && (
      <ol className="mt-2 border-t border-white/7 pt-1.5">
        {result.items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="flex min-w-0 items-baseline gap-2 border-b border-white/[0.045] py-1.5 last:border-b-0">
            <span className="w-3 shrink-0 text-[8px] font-medium tabular-nums text-emerald-100/28">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-medium text-white/58">{item.title}</div>
              {item.subtitle && (
                <div className="truncate text-[9px] text-white/28">{item.subtitle}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    )}
  </div>
);

const WebToolSummary: FC<{
  running: boolean;
  details: ReturnType<typeof getAgentWebToolDetails>;
}> = ({ details, running }) => {
  const metrics = [
    details.results.length ? `${details.results.length} 条结果` : "",
    details.linkCount === undefined ? "" : `${details.linkCount} 个链接`,
    details.contentChars === undefined ? "" : `${formatChars(details.contentChars)} 字符`,
    details.truncated ? "内容已裁剪" : ""
  ].filter(Boolean);
  const heading = details.query ? "网页搜索" : "网页来源";
  const searchScope = details.query
    ? [details.scopeLabel, details.scopeDomains.join(" / ")].filter(Boolean).join(" · ")
    : "";
  const provenance = [
    details.author ? `作者 ${details.author}` : "",
    details.publishedAt ? formatWebPublishedAt(details.publishedAt) : ""
  ].filter(Boolean);

  return (
    <div className="min-w-0 rounded-r-lg border-l border-sky-200/22 bg-sky-100/[0.022] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Globe2 className="size-3 text-sky-100/42" aria-hidden="true" />
        <span className="text-[9px] font-medium tracking-[0.1em] text-sky-100/42">{heading}</span>
        {details.engine && (
          <span className="text-[9px] text-white/25">· {formatEngine(details.engine)}</span>
        )}
      </div>
      <div className="mt-1 truncate text-[12px] leading-5 font-medium text-white/76">
        {details.title ||
          details.query ||
          details.domain ||
          (running ? "正在连接网页" : "网页结果")}
      </div>
      {(searchScope || details.domain || details.site) && (
        <div className="mt-0.5 truncate text-[10px] text-white/34">
          {searchScope || details.domain || details.site}
        </div>
      )}
      {provenance.length > 0 && (
        <div className="mt-0.5 truncate text-[9px] text-white/28">{provenance.join(" · ")}</div>
      )}
      {metrics.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[9px] text-white/30">
          {metrics.map((metric, index) => (
            <span key={metric} className="flex items-center gap-2">
              {index > 0 && <span className="text-white/16">·</span>}
              {metric}
            </span>
          ))}
        </div>
      )}
      {details.results.length > 0 && (
        <ol className="mt-2.5 border-t border-white/7 pt-1.5" aria-label="网页来源">
          {details.results.slice(0, 3).map((result, index) => (
            <li
              key={result.url}
              className="flex min-w-0 items-start gap-2 border-b border-white/[0.045] py-1.5 last:border-b-0">
              <span className="mt-0.5 w-3 shrink-0 text-[8px] font-medium tabular-nums text-sky-100/30">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[10px] font-medium text-white/62"
                  title={result.title}>
                  {result.title}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] text-white/28">
                  <span className="shrink-0 rounded bg-white/[0.035] px-1 py-px text-sky-100/34">
                    {result.domain}
                  </span>
                  {result.snippet && <span className="truncate">· {result.snippet}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {details.url && !details.results.length && (
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[9px] text-white/28">
          <Globe2 className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{details.url}</span>
        </div>
      )}
    </div>
  );
};

function formatWebPublishedAt(value: string) {
  const calendarDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!calendarDate) return value;
  return `${calendarDate[1]}年${Number(calendarDate[2])}月${Number(calendarDate[3])}日`;
}

const CodeBlock: FC<{ label: string; value: string }> = memo(({ label, value }) => (
  <div className="min-w-0">
    <div className="mb-1 text-[9px] font-medium tracking-[0.08em] text-white/26">{label}</div>
    <pre
      className="
        agent-scroll max-h-56 min-w-0 overflow-auto whitespace-pre-wrap break-words
        rounded-lg border border-white/7 bg-black/20 p-2.5 font-mono text-[10px]
        leading-4 text-white/52
      ">
      {value}
    </pre>
  </div>
));

const StatusIcon: FC<{ status: AgentToolTimelineItem["status"] }> = ({ status }) => {
  if (status === "running") {
    return <LoaderCircle className="size-3.5 shrink-0 animate-spin text-sky-100/72" />;
  }
  if (status === "error") {
    return <AlertCircle className="size-3.5 shrink-0 text-red-100/72" />;
  }
  return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-100/68" />;
};

const shouldAutoOpen = () => true;

const getStatusVisual = (status: AgentToolTimelineItem["status"]) => {
  if (status === "running") {
    return {
      rail: "animate-pulse bg-sky-200/65",
      badge: "border-sky-200/12 bg-sky-200/[0.055] text-sky-100/62"
    };
  }
  if (status === "error") {
    return {
      rail: "bg-red-200/70",
      badge: "border-red-200/13 bg-red-200/[0.055] text-red-100/66"
    };
  }
  return {
    rail: "bg-emerald-200/45",
    badge: "border-emerald-200/10 bg-emerald-200/[0.045] text-emerald-100/58"
  };
};

const getStatusLabel = (status: AgentToolTimelineItem["status"]) => {
  if (status === "running") return "执行中";
  if (status === "error") return "失败";
  return "完成";
};

const formatTechnicalValue = (value: string) => {
  const parsed = parseAgentToolValue(value);
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
};

const formatChars = (value: number) => {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 10_000).toFixed(value < 100_000 ? 1 : 0)}万`;
};

const formatEngine = (engine: string) => {
  if (engine.toLowerCase() === "duckduckgo") return "DuckDuckGo";
  if (engine.toLowerCase() === "bing") return "Bing";
  return engine;
};

const useAccessibleID = (prefix: string) => {
  const id = useId().replaceAll(":", "");
  return `${prefix}-${id}`;
};

export default memo(ToolStep);
