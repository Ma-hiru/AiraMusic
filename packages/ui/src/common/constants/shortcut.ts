export type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";

export interface ShortcutBinding {
  key: string;
  modifiers?: ShortcutModifier[];
}

/** 可配置快捷键的动作 */
export type ShortcutAction =
  | "volumeUp"
  | "nextTrack"
  | "prevTrack"
  | "muteToggle"
  | "playToggle"
  | "volumeDown"
  | "playModalToggle";

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

  /** 判断两个绑定是否等价（按键忽略大小写，修饰键忽略顺序） */
  static isSameBinding(a: ShortcutBinding, b: ShortcutBinding): boolean {
    if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;
    const am = new Set(a.modifiers ?? []);
    const bm = new Set(b.modifiers ?? []);
    return am.size === bm.size && [...am].every((modifier) => bm.has(modifier));
  }
}
