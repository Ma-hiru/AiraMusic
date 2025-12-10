import { useEffect, useRef } from "react";

type ModifierKey = "ctrl" | "shift" | "alt" | "meta";
type Key = string;

export interface ShortcutConfig {
  key: Key;
  modifiers?: ModifierKey[];
  callback: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  description?: string;
}

export interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  target?: HTMLElement | Window | null;
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
  const { enabled = true, target = window } = options;
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);

  // 更新 shortcuts ref
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled || !target) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        if (matchShortcut(event, shortcut)) {
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
  }, [enabled, target]);
}

/**
 * 检查键盘事件是否匹配快捷键配置
 */
function matchShortcut(event: KeyboardEvent, shortcut: ShortcutConfig): boolean {
  // 检查主键
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatch) return false;

  // 检查修饰键
  const modifiers = shortcut.modifiers || [];
  const ctrlMatch = modifiers.includes("ctrl") ? event.ctrlKey : !event.ctrlKey;
  const shiftMatch = modifiers.includes("shift") ? event.shiftKey : !event.shiftKey;
  const altMatch = modifiers.includes("alt") ? event.altKey : !event.altKey;
  const metaMatch = modifiers.includes("meta") ? event.metaKey : !event.metaKey;

  return ctrlMatch && shiftMatch && altMatch && metaMatch;
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
  config: Omit<ShortcutConfig, "key" | "callback"> & UseKeyboardShortcutOptions = {}
) {
  const { modifiers, preventDefault, stopPropagation, description, enabled, target } = config;

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

  useKeyboardShortcut(shortcuts, { enabled, target });
}
