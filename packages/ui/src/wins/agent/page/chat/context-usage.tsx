import { memo, type FC } from "react";
import { formatTokenCount } from "@/wins/agent/lib/chat/observability";
import type {
  ProviderConfigView,
  RequestUsageTotals,
  ThreadContextUsage,
  ThreadAuxiliaryUsage
} from "@mahiru/agent/browser";

import UsageTooltip from "./usage-tooltip";

interface ContextUsageProps {
  running: boolean;
  context?: ThreadContextUsage;
  auxiliaryUsage?: ThreadAuxiliaryUsage;
  config: Undefinable<ProviderConfigView>;
}

const ContextUsage: FC<ContextUsageProps> = ({ config, context, running, auxiliaryUsage }) => {
  if (!config) return null;
  const matchingConfig = context?.configId === config.id;
  const percentage =
    context && matchingConfig && context.capacityTokens > 0
      ? (context.estimatedTokens / context.capacityTokens) * 100
      : undefined;
  const progress = percentage === undefined ? undefined : Math.max(0, Math.min(100, percentage));
  const value = !context
    ? "上下文用量待同步"
    : percentage === undefined
      ? `${formatTokenCount(context.estimatedTokens)} Token · 容量待更新`
      : `${formatTokenCount(context.estimatedTokens)} / ${config.contextSize} · ${percentage.toFixed(1)}%`;
  const description = !context
    ? "尚未同步上下文用量，不把未知用量记作零。"
    : !matchingConfig
      ? "已切换模型配置，下次发送时按所选配置更新上限。"
      : context.capacityTokens <= 0
        ? "配置容量未知，暂不计算上下文占比。"
        : `${running ? "生成中，显示最近同步值。" : "上下文用量为最近同步的估算值。"}不含输入框草稿；上限来自模型配置，服务端实际限制可能不同。`;

  return (
    <UsageTooltip
      className="inline-flex size-8 shrink-0 cursor-default items-center justify-center rounded-full text-white/45 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      placement="left"
      aria-label="当前上下文估算"
      aria-valuenow={progress}
      role={progress === undefined ? "img" : "progressbar"}
      aria-valuemin={progress === undefined ? undefined : 0}
      aria-valuemax={progress === undefined ? undefined : 100}
      aria-valuetext={progress === undefined ? undefined : value}
      content={
        <span className="block max-w-60">
          <span className="block font-medium text-white/85">{value}</span>
          <span className="mt-1 block text-white/48">{description}</span>
          {auxiliaryUsage && (
            <span className="mt-2 block border-t border-white/10 pt-2">
              <span className="block font-medium text-white/70">本会话辅助请求</span>
              <AuxiliaryUsage label="标题总结" usage={auxiliaryUsage.title} />
              <AuxiliaryUsage label="历史压缩" usage={auxiliaryUsage.compaction} />
            </span>
          )}
        </span>
      }>
      <svg
        className={
          percentage !== undefined && percentage >= 80 ? "size-5 text-amber-200/70" : "size-5"
        }
        aria-hidden="true"
        viewBox="0 0 24 24">
        <circle
          r="9"
          cx="12"
          cy="12"
          fill="none"
          opacity="0.2"
          strokeWidth="2"
          stroke="currentColor"
        />
        {progress !== undefined ? (
          <circle
            className="origin-center -rotate-90"
            r="9"
            cx="12"
            cy="12"
            fill="none"
            strokeWidth="2"
            pathLength="100"
            stroke="currentColor"
            strokeDasharray="100"
            strokeLinecap="round"
            strokeDashoffset={100 - progress}
          />
        ) : (
          <text x="12" y="15" fontSize="9" fill="currentColor" textAnchor="middle">
            ?
          </text>
        )}
      </svg>
    </UsageTooltip>
  );
};

const AuxiliaryUsage: FC<{ label: string; usage: RequestUsageTotals }> = ({ label, usage }) => {
  const complete = usage.requests === usage.reportedRequests;
  return (
    <span className="mt-1.5 block text-white/48">
      <span className="block text-white/65">{label}</span>
      <span className="block">
        {usage.requests === 0
          ? "尚未发起请求"
          : `${usage.requests} 次请求 · ${usage.reportedRequests} 次报告${complete ? "" : " · 统计不完整"}`}
      </span>
      {usage.reportedRequests > 0 && (
        <span className="block tabular-nums">
          {complete ? "累计" : "已知累计"}输入 {formatTokenCount(usage.promptTokens)} · 输出{" "}
          {formatTokenCount(usage.completionTokens)} Token
        </span>
      )}
    </span>
  );
};

export default memo(ContextUsage);
