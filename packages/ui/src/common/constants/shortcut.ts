import type { ShortcutAction } from "@mahiru/ipc/types";

export type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";

export interface ShortcutBinding {
  key: string;
  modifiers?: ShortcutModifier[];
}

/** 可配置快捷键的动作；跨窗口转发时使用同一套取值 */
export type { ShortcutAction };

export type ShortcutBindingMap = Record<ShortcutAction, ShortcutBinding>;

export class RendererShortcutConstants {
  /** 各动作的展示名，设置页与快捷键 description 共用 */
  static readonly actionLabels: Record<ShortcutAction, string> = {
    playToggle: "播放/暂停",
    prevTrack: "上一首",
    nextTrack: "下一首",
    volumeUp: "增加音量",
    volumeDown: "减少音量",
    muteToggle: "静音/取消静音",
    playModalToggle: "切换播放页"
  };

  /** 全部可配置动作；顺序同时决定按键解析时的优先级 */
  static readonly actions = Object.keys(this.actionLabels) as ShortcutAction[];

  /** 不参与快捷键转发的窗口：主窗口自己执行，登录页与外部网页窗没有播放上下文 */
  static readonly shortcutForwardExcluded: WindowType[] = ["main", "login", "external"];

  /** 默认快捷键（每次返回新对象，避免默认值被外部修改） */
  static get defaultBindings(): ShortcutBindingMap {
    return {
      playToggle: { key: " " },
      prevTrack: { key: "ArrowLeft", modifiers: ["alt"] },
      nextTrack: { key: "ArrowRight", modifiers: ["alt"] },
      volumeUp: { key: "ArrowUp" },
      volumeDown: { key: "ArrowDown" },
      muteToggle: { key: "M" },
      playModalToggle: { key: "P", modifiers: ["alt"] }
    };
  }

  static readonly modifierLabels: Record<ShortcutModifier, string> = {
    ctrl: "Ctrl",
    shift: "Shift",
    alt: "Alt",
    meta: "Win"
  };

  static readonly macModifierLabels: Record<ShortcutModifier, string> = {
    ctrl: "Control",
    shift: "Shift",
    alt: "Option",
    meta: "Command"
  };

  static readonly keyLabels: Record<string, string> = {
    " ": "Space",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc"
  };

  /** Option 会改变输入字符，字母和数字组合键用 code 还原主键。 */
  static fromEvent(event: KeyboardEvent): Nullable<ShortcutBinding> {
    if (event.isComposing || ["Control", "Shift", "Alt", "Meta", "Process"].includes(event.key)) {
      return null;
    }

    let key = event.key;
    if (event.altKey) {
      const codeKey = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code);
      key = codeKey?.[1] ?? codeKey?.[2] ?? key;
    }
    if (!key || ["Dead", "Unidentified"].includes(key)) return null;

    return {
      key,
      modifiers: [
        event.ctrlKey && "ctrl",
        event.shiftKey && "shift",
        event.altKey && "alt",
        event.metaKey && "meta"
      ].filter(Boolean) as ShortcutModifier[]
    };
  }

  static matchesEvent(event: KeyboardEvent, binding: ShortcutBinding): boolean {
    const pressed = this.fromEvent(event);
    if (!pressed) return false;
    return (
      this.isSameBinding(pressed, binding) ||
      // 兼容之前按输入字符保存的自定义绑定。
      this.isSameBinding({ ...pressed, key: event.key }, binding)
    );
  }

  /** 按绑定表把事件解析成动作；只有命中已配置绑定才返回，未绑定的按键一律返回 null */
  static resolveAction(
    event: KeyboardEvent,
    bindings: ShortcutBindingMap
  ): Nullable<ShortcutAction> {
    for (const action of this.actions) {
      const binding = bindings[action];
      if (binding && this.matchesEvent(event, binding)) return action;
    }
    return null;
  }

  /** 事件是否发生在可编辑元素上，全局快捷键与跨窗口转发都要据此避让输入 */
  static isEditableEvent(event: KeyboardEvent): boolean {
    return event
      .composedPath()
      .some(
        (node) =>
          node instanceof HTMLElement &&
          (node.isContentEditable ||
            node.matches(
              'input, textarea, select, [role="textbox"], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
            ))
      );
  }

  /** 该窗口是否需要把命中的快捷键转发给主窗口执行 */
  static canForwardShortcut(windowType: WindowType): boolean {
    return !this.shortcutForwardExcluded.includes(windowType);
  }

  /** 判断两个绑定是否等价（按键忽略大小写，修饰键忽略顺序） */
  static isSameBinding(a: ShortcutBinding, b: ShortcutBinding): boolean {
    if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;
    const am = new Set(a.modifiers ?? []);
    const bm = new Set(b.modifiers ?? []);
    return am.size === bm.size && [...am].every((modifier) => bm.has(modifier));
  }
}
