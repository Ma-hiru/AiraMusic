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

  static readonly keyLabels: Record<string, string> = {
    " ": "Space",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc"
  };

  /** 判断两个绑定是否等价（按键忽略大小写，修饰键忽略顺序） */
  static isSameBinding(a: ShortcutBinding, b: ShortcutBinding): boolean {
    if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;
    const am = new Set(a.modifiers ?? []);
    const bm = new Set(b.modifiers ?? []);
    return am.size === bm.size && [...am].every((modifier) => bm.has(modifier));
  }
}
