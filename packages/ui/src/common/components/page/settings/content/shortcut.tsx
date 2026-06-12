import { type FC, memo, useEffect, useState } from "react";
import { cx } from "@emotion/css";
import {
  Disc3,
  Keyboard,
  type LucideIcon,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX
} from "lucide-react";
import {
  RendererShortcutConstants,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutBindingMap,
  type ShortcutModifier
} from "@/common/constants/shortcut";
import { RendererFormat } from "@/common/lib/format";
import type { NeteaseSettingsModel } from "@/common/netease/models";

import BaseItem from "./base-item";
import Card from "@/common/components/layout/card";
import AppToast from "@/common/components/display/toast";

interface ShortcutSettings {
  data: ShortcutBindingMap;
  patchSettings: NormalFunc<[patch: Partial<NeteaseSettingsModel>]>;
}

const actionIcons: Record<ShortcutAction, LucideIcon> = {
  playToggle: Play,
  prevTrack: SkipBack,
  nextTrack: SkipForward,
  volumeUp: Volume2,
  volumeDown: Volume1,
  muteToggle: VolumeX,
  playModalToggle: Disc3
};

const actions = Object.keys(actionIcons) as ShortcutAction[];

const modifierKeys = ["Control", "Shift", "Alt", "Meta"];

const Shortcut: FC<ShortcutSettings> = ({ data, patchSettings }) => {
  const [recording, setRecording] = useState<Nullable<ShortcutAction>>(null);

  useEffect(() => {
    if (!recording) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // 单独按下修饰键时继续等待主键
      if (modifierKeys.includes(event.key)) return;
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }

      const binding: ShortcutBinding = {
        key: event.key,
        modifiers: [
          event.ctrlKey && "ctrl",
          event.shiftKey && "shift",
          event.altKey && "alt",
          event.metaKey && "meta"
        ].filter(Boolean) as ShortcutModifier[]
      };
      const conflict = actions.find(
        (action) =>
          action !== recording && RendererShortcutConstants.isSameBinding(data[action], binding)
      );
      if (conflict) {
        AppToast.show({
          type: "error",
          text: `与「${RendererShortcutConstants.actionLabels[conflict]}」的快捷键冲突`
        });
      } else {
        patchSettings({ shortcuts: { ...data, [recording]: binding } });
      }
      setRecording(null);
    };
    // capture + stopPropagation：录制期间不触发已注册的全局快捷键
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [recording, data, patchSettings]);

  return (
    <Card Icon={Keyboard} title="快捷键" subTitle="Shortcuts">
      {actions.map((action) => {
        const isRecording = recording === action;
        return (
          <BaseItem key={action} icon={actionIcons[action]}>
            <section className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black tracking-normal">
                  {RendererShortcutConstants.actionLabels[action]}
                </h3>
              </div>
              <button
                type="button"
                title={isRecording ? "按 Esc 取消" : "点击修改快捷键"}
                onClick={() => setRecording(isRecording ? null : action)}
                className={cx(
                  `
                  h-7 min-w-24 shrink-0 rounded-md border px-3
                  text-xs font-semibold
                  transition-all duration-300 ease-in-out
                  cursor-pointer hover:opacity-50 active:scale-95
                `,
                  isRecording ? "border-(--theme-color-main) animate-pulse" : "border-white/50"
                )}>
                {isRecording ? "按下新的快捷键…" : RendererFormat.shortcut(data[action])}
              </button>
            </section>
          </BaseItem>
        );
      })}
      <BaseItem icon={RotateCcw}>
        <section className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-black tracking-normal">恢复默认</h3>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4">
              将以上所有快捷键恢复为默认绑定。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRecording(null);
              patchSettings({ shortcuts: RendererShortcutConstants.defaultBindings });
            }}
            className={`
              h-7 shrink-0 rounded-md border border-white/50 px-3
              text-xs font-semibold
              transition-all duration-300 ease-in-out
              cursor-pointer hover:opacity-50 active:scale-95
            `}>
            恢复
          </button>
        </section>
      </BaseItem>
    </Card>
  );
};

export default memo(Shortcut);
