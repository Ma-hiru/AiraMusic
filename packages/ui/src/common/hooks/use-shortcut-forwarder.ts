import { useEffect } from "react";
import { useSettings } from "@/common/store/settings";
import { RendererRuntime } from "@/common/lib/runtime";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { RendererShortcutConstants } from "@/common/constants/shortcut";

export interface UseShortcutForwarderOptions {
  enabled?: boolean;
}

/**
 * 子窗口聚焦时的快捷键转发器。
 *
 * 子窗口没有播放器实例，命中的快捷键统一转发给主窗口执行；转发前做过滤，
 * 只有「当前配置里真实绑定的动作」才会离开本窗口，其余按键保持原生语义：
 * - 主窗口、登录页、外部网页窗不参与转发
 * - 输入法组合中（`isComposing`）不转发，避免抢占中文输入
 * - 事件已被页面自行 `preventDefault` 时不转发，尊重局部交互
 * - 焦点位于 input / textarea / contenteditable 时不转发，避免抢走输入
 * - 只按修饰键、`Dead`、`Unidentified` 等无主键事件由 `fromEvent` 直接过滤
 * - 未命中任何绑定（如打字、Tab、Escape）不转发
 */
export function useShortcutForwarder(options: UseShortcutForwarderOptions = {}) {
  const { enabled = true } = options;
  const shortcuts = useSettings().shortcuts;
  const bindingsRef = useLatestRef(shortcuts);
  const active =
    enabled && RendererShortcutConstants.canForwardShortcut(RendererRuntime.currentWindowType);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (RendererShortcutConstants.isEditableEvent(event)) return;

      const action = RendererShortcutConstants.resolveAction(event, bindingsRef.current);
      if (!action) return;

      event.preventDefault();
      RendererIPCMessageBus.forwardShortcut(action);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, bindingsRef]);
}
