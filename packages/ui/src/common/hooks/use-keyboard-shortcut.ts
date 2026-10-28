import { useRef, useEffect } from "react";
import { type ShortcutBinding, RendererShortcutConstants } from "@/common/constants/shortcut";

type Key = string;

export interface ShortcutConfig extends ShortcutBinding {
  description?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  callback: (event: KeyboardEvent) => void;
}

export interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  ignoreEditable?: boolean;
  target?: null | Window | HTMLElement;
}

/**
 * 快捷键注册 Hook
 * @example
 * useKeyboardShortcut([
 *   { key: ' ', callback: togglePlay, description: '播放/暂停' },
 *   { key: 'ArrowRight', callback: nextTrack, description: '下一首' },
 *   { key: 'ArrowLeft', callback: prevTrack, description: '上一首' },
 *   { key: 'ArrowUp', modifiers: ['ctrl'], callback: volumeUp, description: '音量增加' }
 * ]);
 */
export function useKeyboardShortcut(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutOptions = {}
) {
  const { enabled = true, target = window, ignoreEditable = false } = options;
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled || !target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ignoreEditable &&
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof HTMLElement &&
              (node.isContentEditable ||
                node.matches(
                  'input, textarea, select, [role="textbox"], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
                ))
          )
      ) {
        return;
      }
      for (const shortcut of shortcutsRef.current) {
        if (RendererShortcutConstants.matchesEvent(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          shortcut.callback(event);
          break; // 只执行第一个匹配的快捷键
        }
      }
    };
    target.addEventListener("keydown", handleKeyDown as EventListener);
    return () => {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [enabled, target, ignoreEditable]);
}

/**
 * 单个快捷键注册的简化版本
 * @example
 * useSingleShortcut(' ', togglePlay);
 * useSingleShortcut('ArrowRight', nextTrack, { modifiers: ['ctrl'] });
 */
export function useSingleShortcut(
  key: Key,
  callback: (event: KeyboardEvent) => void,
  config: UseKeyboardShortcutOptions & Omit<ShortcutConfig, "key" | "callback"> = {}
) {
  const {
    target,
    enabled,
    modifiers,
    description,
    ignoreEditable,
    preventDefault,
    stopPropagation
  } = config;

  const shortcuts: ShortcutConfig[] = [
    {
      key,
      modifiers,
      callback,
      preventDefault,
      stopPropagation,
      description
    }
  ];

  useKeyboardShortcut(shortcuts, { enabled, target, ignoreEditable });
}
