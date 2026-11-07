import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import {
  Ban,
  Info,
  ListEnd,
  Database,
  CircleAlert,
  DatabaseZap,
  BrainCircuit,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react";
import { formatTokenCount, getUncachedInputTokens } from "@/wins/agent/lib/chat/observability";
import type { LucideIcon } from "lucide-react";
import type {
  AgentTokenUsage,
  AgentRunTerminal,
  AgentAssistantTurnObservability
} from "@/wins/agent/lib/chat/interface";

import UsageTooltip from "./usage-tooltip";

interface AssistantTurnMetaProps {
  turn: AgentAssistantTurnObservability;
}

const AssistantTurnMeta: FC<AssistantTurnMetaProps> = ({ turn }) => {
  const metrics = getUsageMetrics(turn.usage);
  const showFinishReason = turn.status === "incomplete" || isNotableFinishReason(turn.finishReason);
  if (!metrics.length && !turn.usage && !showFinishReason) return null;

  return (
    <footer className="mt-2.5 text-white/32">
      {turn.usage && <TokenUsageGrid usage={turn.usage} />}
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
        "rounded-xl border px-3 py-2.5 shadow-sm shadow-black/8",
        presentation.className
      )}
      role={terminal.status === "failed" ? "alert" : "status"}>
      <div className="agent-terminal-layout">
        <Icon className="mt-0.5 size-4 shrink-0 opacity-75" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-white/76">{presentation.title}</div>
          <p className="mt-0.5 text-[11px] leading-5 text-white/44">
            {terminal.error || presentation.description}
          </p>
          {(terminal.runID || duration) && (
            <div className="agent-terminal-meta mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-white/24">
              {duration && <span>耗时 {duration}</span>}
              {terminal.runID && <span className="min-w-0 truncate">run {terminal.runID}</span>}
            </div>
          )}
          {terminal.usage && <TokenUsageGrid className="mt-2" usage={terminal.usage} />}
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
  if (!usage) return null;
  const incomplete = usage.coverage === "partial";
  const unknown = usage.coverage === "unknown";

  return (
    <section className={className} aria-label="本轮模型用量">
      <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-white/50">
        <span>本轮模型用量 · Token</span>
        {(incomplete || unknown) && (
          <span className="text-amber-100/55">
            {incomplete ? "统计不完整" : "历史统计覆盖未知"}
          </span>
        )}
        {usage.lastInputStatus === "missing" && <span>末次请求未报告用量</span>}
        {usage.lastInputStatus === "not_requested" && <span>本轮未发起聊天请求</span>}
      </p>
      <dl className="agent-turn-usage text-white/50">
        {metrics.map(({ unit, label, value, emphasis, icon: Icon, description }) => (
          <div
            key={label}
            className={cx("agent-turn-usage-item", emphasis && "text-white/60")}
            title={`${label}: ${value.toLocaleString("zh-CN")} ${unit}。${description}`}>
            <dt className="flex min-w-0 items-center gap-1 text-[9px] font-normal text-white/40">
              <Icon className="size-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="flex min-w-0 items-center gap-1 text-[10px] font-medium tabular-nums text-current">
              {formatTokenCount(value)}
              {(label === "模型请求" || label === "已报告请求") && (
                <>
                  {label === "模型请求" && usage.reportedRequests !== undefined && (
                    <span className="font-normal text-white/35">
                      （已报告 {usage.reportedRequests}）
                    </span>
                  )}
                  <UsageTooltip
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded text-white/40 outline-none hover:text-white/65 focus-visible:ring-2 focus-visible:ring-white/40"
                    role="img"
                    aria-label="本轮用量说明"
                    content="本轮从你这条消息开始。工具调用可能触发多次聊天请求，累计输入会重复计算每次发送的历史，不代表当前上下文占用；不含标题总结和历史压缩请求。模型请求统计实际发起的聊天请求，已报告指收到用量的请求；缺失的用量不会记作零。上下文大小是本轮最后一次请求的输入快照，仅在该次请求报告用量时展示，当前估算见输入框圆环。">
                    <Info className="size-3" aria-hidden="true" />
                  </UsageTooltip>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
    className:
      "border-[color-mix(in_srgb,var(--theme-color-main)_18%,transparent)] bg-[color-mix(in_srgb,var(--theme-color-main)_6%,transparent)] text-[color-mix(in_srgb,var(--theme-color-main)_62%,white)]",
    description: "Agent 已停止继续调用工具。可以缩小任务范围，或基于现有结果继续提问。"
  }
};

const getUsageMetrics = (usage?: AgentTokenUsage) => {
  if (!usage) return [];
  const knownOnly = usage.coverage === "partial" || usage.coverage === "unknown";
  return [
    metric(
      "上下文大小",
      usage.lastInput,
      ArrowDownToLine,
      "本轮最后一次聊天请求收到的输入快照，包含当时的提示、历史和工具定义，不含之后生成的回复；不是输入框圆环显示的当前上下文估算",
      true
    ),
    metric(
      knownOnly ? "本轮已知累计输入" : "本轮累计输入",
      usage.input,
      ArrowDownToLine,
      "本轮各次模型请求输入 Token 相加，重复发送的历史会重复计数"
    ),
    metric(
      knownOnly ? "本轮已知累计输出" : "本轮累计输出",
      usage.output,
      ArrowUpFromLine,
      "本轮各次模型请求生成的 Token 相加，包含服务端计入输出的思考和工具调用"
    ),
    metric(
      "未缓存输入",
      getUncachedInputTokens(usage),
      ArrowDownToLine,
      "累计输入中未命中缓存的部分"
    ),
    metric("输入缓存命中", usage.cachedInput, Database, "累计输入中命中缓存的部分"),
    metric("输入缓存写入", usage.cacheWrite, DatabaseZap, "服务端报告的新写入缓存量"),
    metric(
      "输出中的思考",
      usage.reasoning,
      BrainCircuit,
      "服务端报告的思考 Token，属于输出的一部分"
    ),
    metric(
      "模型请求",
      usage.requests,
      ListEnd,
      "本轮实际发起的聊天请求次数，不含标题、压缩与 HTTP 重试；已报告是收到用量的请求数",
      true,
      "次"
    ),
    ...(usage.requests === undefined
      ? [
          metric(
            "已报告请求",
            usage.reportedRequests,
            ListEnd,
            "历史记录仅保留收到用量的请求数，实际请求次数未知",
            true,
            "次"
          )
        ]
      : [])
  ].filter((item): item is NonNullable<typeof item> => !!item);
};

const metric = (
  label: string,
  value: number | undefined,
  icon: LucideIcon,
  description: string,
  emphasis = false,
  unit = "tokens"
) => {
  return value === undefined ? undefined : { icon, label, value, description, emphasis, unit };
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
