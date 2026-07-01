import { useRef, useEffect } from "react";

type ModifierKey = "alt" | "ctrl" | "meta" | "shift";
type Key = string;

export interface ShortcutConfig {
  key: Key;
  description?: string;
  preventDefault?: boolean;
  modifiers?: ModifierKey[];
  stopPropagation?: boolean;
  callback: (event: KeyboardEvent) => void;
}

export interface UseKeyboardShortcutOptions {
  enabled?: boolean;
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
  const { enabled = true, target = window } = options;
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);
  shortcutsRef.current = shortcuts;

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
  config: UseKeyboardShortcutOptions & Omit<ShortcutConfig, "key" | "callback"> = {}
) {
  const { target, enabled, modifiers, description, preventDefault, stopPropagation } = config;

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
