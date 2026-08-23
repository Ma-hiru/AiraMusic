import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { Bot, Copy, Network, RotateCcw, ServerCog, ShieldCheck, LoaderCircle } from "lucide-react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import Card from "@/common/components/layout/card";
import AppToast from "@/common/components/display/toast";
import type {
  AgentFeatureSettingsState,
  AgentFeatureSettingsMcpTool,
  AgentFeatureSettingsUpdateInput
} from "@mahiru/ipc/types";

import ToggleRow from "./toggle-row";

const AgentSettings: FC = () => {
  const [state, setState] = useState<AgentFeatureSettingsState>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portDraft, setPortDraft] = useState("");

  const applyState = useCallback((next: AgentFeatureSettingsState) => {
    setState(next);
    setPortDraft(String(next.mcpPort));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await RendererIPC.NormalChannel.send(
        "invoke_agent_feature_settings_get",
        undefined
      );
      if (!result.ok) throw new Error(result.reason.message);
      applyState(result.data);
    } catch (error) {
      AppToast.show({ type: "error", text: `加载 Agent 设置失败：${String(error)}` });
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    void load();
    const unsubscribe = RendererIPC.MessageChannel.listen(
      "message_deliver_agent_feature_settings",
      "process",
      applyState
    );
    return unsubscribe;
  }, [applyState, load]);

  const update = useCallback(
    async (patch: AgentFeatureSettingsUpdateInput) => {
      if (saving) return;
      setSaving(true);
      try {
        const result = await RendererIPC.NormalChannel.send(
          "invoke_agent_feature_settings_update",
          patch
        );
        if (!result.ok) throw new Error(result.reason.message);
        applyState(result.data);
      } catch (error) {
        AppToast.show({ type: "error", text: `保存 Agent 设置失败：${String(error)}` });
      } finally {
        setSaving(false);
      }
    },
    [applyState, saving]
  );

  const availableTools = useMemo<AgentFeatureSettingsMcpTool[]>(() => {
    if (!state) return [];
    return [...state.availableMcpTools].sort(
      (left, right) =>
        ToolRiskOrder[left.risk] - ToolRiskOrder[right.risk] ||
        left.label.localeCompare(right.label)
    );
  }, [state]);

  const commitPort = useCallback(() => {
    if (!state) return;
    const port = Number(portDraft.trim());
    if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
      setPortDraft(String(state.mcpPort));
      AppToast.show({ type: "error", text: "MCP 端口必须是 1024 到 65535 的整数" });
      return;
    }
    if (port !== state.mcpPort) void update({ mcpPort: port });
  }, [portDraft, state, update]);

  const copyMcpConfig = useCallback(async () => {
    if (!state) return;
    // 运行中按实际监听端口生成；已开启但未重启生效时按即将生效的端口生成
    const port = state.effective.mcpEnabled ? state.effective.mcpPort : state.mcpPort;
    const config = JSON.stringify(
      {
        mcpServers: {
          "aira-music": {
            url: `http://127.0.0.1:${port}/mcp`
          }
        }
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(config);
      AppToast.show({ type: "success", text: "MCP 配置已复制，粘贴到客户端 mcpServers 即可" });
    } catch {
      AppToast.show({ type: "error", text: "复制失败，请检查剪贴板权限" });
    }
  }, [state]);

  if (loading || !state) {
    return (
      <div className="surface-1 flex min-h-40 items-center justify-center rounded-lg text-white/45">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
        <span className="text-xs">正在读取启动配置</span>
      </div>
    );
  }

  const effectiveAgent = state.effective.agentEnabled;
  const effectiveMcp = state.effective.mcpEnabled;

  return (
    <section className="space-y-4" aria-label="Agent 设置">
      {state.restartRequired && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.055] px-3.5 py-3 text-amber-50/70"
          role="status">
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-amber-50/85">重启后应用完整配置</p>
            <p className="mt-1 text-[11px] leading-5 text-amber-50/48">
              Agent 与 MCP 在应用启动时加载。关闭 Agent 会立即收起入口并结束当前会话；重新开启和 MCP
              配置变更需要重启。
            </p>
          </div>
        </div>
      )}

      <Card
        Icon={Bot}
        title="Agent"
        subTitle="Rust runtime"
        action={<RuntimeBadge label="本次启动" active={effectiveAgent} />}>
        <ToggleRow
          icon={Bot}
          title="启用 Agent"
          disabled={saving}
          checked={state.agentEnabled}
          description="启动独立 Rust Agent 服务，并显示主界面的音乐助手入口。"
          onClick={() => void update({ agentEnabled: !state.agentEnabled })}
        />
        <div className="mx-12 border-t border-white/[0.055] pt-3 text-[11px] leading-5 text-white/38">
          <p>
            Rust Agent 始终通过内部凭证使用完整工具目录。下方公开 MCP
            开关和工具选择只影响外部客户端。
          </p>
          <p className="mt-1">
            关闭时会立即终止仍在运行的请求并关闭窗口，不会删除对话、Provider 或 API Key。
          </p>
        </div>
      </Card>

      <Card
        Icon={ServerCog}
        title="外部 MCP 接入"
        subTitle="Public loopback endpoint"
        action={<RuntimeBadge label="公开访问" active={effectiveMcp} />}>
        <ToggleRow
          icon={Network}
          disabled={saving}
          title="允许外部 MCP 客户端"
          checked={state.mcpEnabled}
          description="通过 127.0.0.1 向本机客户端公开所选工具；Rust Agent 不依赖此开关。"
          onClick={() => void update({ mcpEnabled: !state.mcpEnabled })}
        />

        <div className="grid gap-3 border-t border-white/[0.055] py-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="flex min-w-0 items-start gap-3 px-3 sm:px-12">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-200/60" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/72">仅限回环地址；工具按勾选公开</p>
              <p className="mt-1 text-[11px] leading-5 text-white/38">
                默认只选择无副作用的查询工具。播放控制、写操作和高风险工具必须手动开启；这些选择不会限制内部
                Rust Agent。
              </p>
            </div>
          </div>
          <label className="px-3 sm:px-0 sm:pr-3">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              监听端口
            </span>
            <input
              className="h-9 w-full rounded-md border border-white/12 bg-white/[0.055] px-3 font-mono text-xs text-white/72 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-40"
              disabled={saving}
              value={portDraft}
              inputMode="numeric"
              aria-label="MCP 监听端口"
              onBlur={commitPort}
              onChange={(event) => setPortDraft(event.currentTarget.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setPortDraft(String(state.mcpPort));
              }}
            />
          </label>
        </div>

        {state.mcpEnabled && (
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.055] px-3 py-3 sm:px-12">
            <button
              className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/[0.09] px-3 py-1.5 text-[11px] font-semibold text-white/72 transition-colors hover:bg-primary/[0.16] disabled:opacity-40"
              type="button"
              disabled={saving}
              onClick={() => void copyMcpConfig()}>
              <Copy className="size-3.5" aria-hidden="true" />
              复制 MCP 配置
            </button>
            <p className="min-w-0 flex-1 text-[10px] leading-4 text-white/35">
              粘贴到 Cursor / Claude 等客户端的 mcpServers 配置中，重启客户端后即可连接本机 MCP。
            </p>
          </div>
        )}

        <div className="border-t border-white/[0.055] px-3 pt-3 sm:px-12">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/72">公开工具</p>
              <p className="mt-0.5 text-[10px] text-white/35">
                仅影响外部客户端 · 已选择 {state.mcpTools.length} / {availableTools.length}
              </p>
            </div>
            {effectiveMcp && (
              <code className="max-w-[55%] truncate rounded bg-black/20 px-2 py-1 text-[9px] text-white/38">
                http://127.0.0.1:{state.effective.mcpPort}/mcp
              </code>
            )}
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto pr-1 scrollbar scrollbar-show sm:grid-cols-2">
            {availableTools.map((tool) => {
              const checked = state.mcpTools.includes(tool.name);
              const onlySelected = checked && state.mcpTools.length === 1;
              return (
                <button
                  key={tool.name}
                  className={cx(
                    "flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-35",
                    checked
                      ? "border-primary/25 bg-primary/[0.09] text-white/72"
                      : "border-white/[0.055] bg-white/[0.025] text-white/45 hover:bg-white/[0.06]"
                  )}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={saving || !state.mcpEnabled || onlySelected}
                  onClick={() =>
                    void update({
                      mcpTools: checked
                        ? state.mcpTools.filter((name) => name !== tool.name)
                        : [...state.mcpTools, tool.name]
                    })
                  }>
                  <span
                    className={cx(
                      "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px]",
                      checked ? "border-primary bg-primary text-primary-text" : "border-white/20"
                    )}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                        {tool.label}
                      </span>
                      <ToolRiskBadge risk={tool.risk} />
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[9px] leading-4 opacity-50">
                      {tool.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </section>
  );
};

const ToolRiskOrder: Record<AgentFeatureSettingsMcpTool["risk"], number> = {
  read: 0,
  write: 1,
  destructive: 2
};

const ToolRiskBadge: FC<{ risk: AgentFeatureSettingsMcpTool["risk"] }> = ({ risk }) => {
  const presentation = {
    read: { label: "只读", className: "border-emerald-200/15 text-emerald-100/55" },
    write: { label: "写操作", className: "border-amber-200/15 text-amber-100/60" },
    destructive: { label: "高风险", className: "border-red-200/20 text-red-100/65" }
  }[risk];

  return (
    <span
      className={cx(
        "shrink-0 rounded border bg-black/10 px-1.5 py-0.5 text-[8px] font-semibold",
        presentation.className
      )}>
      {presentation.label}
    </span>
  );
};

const RuntimeBadge: FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/10 px-2 py-1 text-[9px] text-white/40">
    <span className={cx("size-1.5 rounded-full", active ? "bg-emerald-300" : "bg-white/25")} />
    {label}：{active ? "运行中" : "未运行"}
  </span>
);

export default memo(AgentSettings);
