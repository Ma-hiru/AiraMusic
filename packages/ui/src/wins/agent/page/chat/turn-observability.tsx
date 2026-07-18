import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import {
  Ban,
  Sigma,
  ListEnd,
  Database,
  CircleAlert,
  DatabaseZap,
  BrainCircuit,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  AgentTokenUsage,
  AgentRunTerminal,
  AgentAssistantTurnObservability
} from "@/wins/agent/page/types";

import { formatTokenCount, getUncachedInputTokens } from "./observability";

interface AssistantTurnMetaProps {
  turn: AgentAssistantTurnObservability;
}

const AssistantTurnMeta: FC<AssistantTurnMetaProps> = ({ turn }) => {
  const metrics = getUsageMetrics(turn.usage);
  const showFinishReason = turn.status === "incomplete" || isNotableFinishReason(turn.finishReason);
  if (!metrics.length && !showFinishReason) return null;

  return (
    <footer className="mt-2.5 text-white/32">
      {metrics.length > 0 && <TokenUsageGrid usage={turn.usage} />}
      {showFinishReason && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
          {turn.status === "incomplete" && (
            <span className="rounded-full border border-amber-200/13 bg-amber-200/7 px-2 py-0.5 font-semibold text-amber-100/62">
              回复未完整结束
            </span>
          )}
          {turn.finishReason && (
            <span className="font-mono text-white/26">finish: {turn.finishReason}</span>
          )}
        </div>
      )}
    </footer>
  );
};

interface RunTerminalCardProps {
  terminal: AgentRunTerminal;
}

const RunTerminalCard: FC<RunTerminalCardProps> = ({ terminal }) => {
  const presentation = terminalPresentation[terminal.status];
  const Icon = presentation.icon;
  const duration = readDuration(terminal);

  return (
    <article
      className={cx(
        "agent-terminal-card",
        "rounded-2xl border px-3.5 py-3 shadow-sm shadow-black/8",
        presentation.className
      )}
      role={terminal.status === "failed" ? "alert" : "status"}>
      <div className="agent-terminal-layout">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-current/12 bg-black/12">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-white/78">{presentation.title}</div>
          <p className="mt-0.5 text-[11px] leading-5 text-white/45">
            {terminal.error || presentation.description}
          </p>
          {(terminal.runID || duration) && (
            <div className="agent-terminal-meta mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-white/25">
              {duration && <span>耗时 {duration}</span>}
              {terminal.runID && <span className="min-w-0 truncate">run {terminal.runID}</span>}
            </div>
          )}
          {terminal.usage && <TokenUsageGrid className="mt-2.5" usage={terminal.usage} />}
        </div>
      </div>
    </article>
  );
};

const TokenUsageGrid: FC<{ className?: string; usage?: AgentTokenUsage }> = ({
  className,
  usage
}) => {
  const metrics = getUsageMetrics(usage);
  if (!metrics.length) return null;

  return (
    <dl className={cx("agent-turn-usage", className)} aria-label="本轮 Token 用量">
      {metrics.map(({ label, value, emphasis, icon: Icon }) => (
        <div
          key={label}
          className={cx("agent-turn-usage-item", emphasis && "text-white/48")}
          title={`${label}: ${value.toLocaleString("zh-CN")} tokens`}>
          <dt className="flex min-w-0 items-center gap-1 text-[8px] font-normal text-white/27">
            <Icon className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </dt>
          <dd className="text-[9px] font-medium tabular-nums text-current">
            {formatTokenCount(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const terminalPresentation: Record<
  AgentRunTerminal["status"],
  {
    title: string;
    icon: LucideIcon;
    className: string;
    description: string;
  }
> = {
  failed: {
    icon: CircleAlert,
    title: "本轮运行失败",
    className: "border-red-200/13 bg-red-200/[0.055] text-red-100/68",
    description: "模型或工具执行时发生错误。你可以调整问题后重新发送。"
  },
  aborted: {
    icon: Ban,
    title: "本轮已停止",
    className: "border-amber-200/12 bg-amber-200/[0.045] text-amber-100/65",
    description: "生成已被停止，停止前已经产生的内容仍保留在当前对话中。"
  },
  max_steps: {
    icon: ListEnd,
    title: "已达到最大步骤",
    className: "border-sky-200/12 bg-sky-200/[0.045] text-sky-100/65",
    description: "Agent 已停止继续调用工具。可以缩小任务范围，或基于现有结果继续提问。"
  }
};

const getUsageMetrics = (usage?: AgentTokenUsage) => {
  if (!usage) return [];
  return [
    metric("累计输入", usage.input, ArrowDownToLine),
    metric("未缓存", getUncachedInputTokens(usage), ArrowDownToLine, true),
    metric("输出", usage.output, ArrowUpFromLine),
    metric("总计", usage.total, Sigma),
    metric("缓存命中", usage.cachedInput, Database),
    metric("缓存写入", usage.cacheWrite, DatabaseZap),
    metric("推理", usage.reasoning, BrainCircuit)
  ].filter((item): item is NonNullable<typeof item> => !!item);
};

const metric = (label: string, value: number | undefined, icon: LucideIcon, emphasis = false) => {
  return value === undefined ? undefined : { icon, label, value, emphasis };
};

const isNotableFinishReason = (reason?: string) => {
  return !!reason && reason !== "stop" && reason !== "tool_calls";
};

const readDuration = (terminal: AgentRunTerminal) => {
  if (terminal.startedAt === undefined || terminal.endedAt === undefined) return undefined;
  const duration = Math.max(0, terminal.endedAt - terminal.startedAt);
  if (duration < 1_000) return `${duration}ms`;
  if (duration < 60_000) return `${(duration / 1_000).toFixed(duration < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(duration / 60_000);
  const seconds = Math.round((duration % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
};

export { RunTerminalCard, AssistantTurnMeta };

export default memo(AssistantTurnMeta);
