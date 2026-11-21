import { app, Menu } from "electron";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import type { MenuItemConstructorOptions } from "electron";
import type { MessageData } from "@mahiru/ipc/types";

/** 循环模式的取值与渲染层 `player.playlist.repeat` 一致 */
type RepeatMode = "all" | "off" | "one";

/**
 * macOS Dock 右键菜单：播放控制 + 循环 / 随机。
 *
 * 菜单由 AppKit 原生渲染，系统会自动在其后追加
 * 「选项 / 显示所有窗口 / 隐藏 / 退出」等 Dock 标准项。
 */
export class MainDockMenu {
  private static registered = false;
  /** 持有菜单引用：Dock 侧不保证强引用，回收后右键会退回系统默认菜单 */
  private static menu: Nullable<Menu> = null;
  private static playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;
  /** 只有影响菜单内容的字段变化时才重建，避免歌词刷新把已展开的菜单顶掉 */
  private static signature = "";

  static register() {
    if (process.platform !== "darwin" || this.registered) return;
    if (!app.dock) return;
    this.registered = true;

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      this.playerBus = data;
      this.apply();
    });

    this.apply();
  }

  private static apply() {
    const dock = app.dock;
    if (!dock) return;

    const data = this.playerBus;
    const playing = data?.status === "playing";
    const repeat = data?.repeat ?? "off";
    const shuffle = Boolean(data?.shuffle);
    const shuffleEnabled = (data?.mode ?? "normal") === "normal";
    const signature = `${playing}|${repeat}|${shuffle}|${shuffleEnabled}`;
    if (signature === this.signature) return;
    this.signature = signature;

    try {
      this.menu = Menu.buildFromTemplate(this.template(playing, repeat, shuffle, shuffleEnabled));
      dock.setMenu(this.menu);
      Log.debug("dock", "menu updated", signature);
    } catch (err) {
      Log.warn("dock", "failed to update the dock menu", err);
    }
  }

  private static template(
    playing: boolean,
    repeat: RepeatMode,
    shuffle: boolean,
    shuffleEnabled: boolean
  ): MenuItemConstructorOptions[] {
    return [
      {
        label: playing ? "暂停" : "播放",
        click: () => this.dispatchPlayer("play-toggle")
      },
      {
        label: "下一首",
        click: () => this.dispatchPlayer("next")
      },
      {
        label: "上一首",
        click: () => this.dispatchPlayer("previous")
      },
      { type: "separator" },
      {
        label: "循环播放",
        submenu: [
          {
            label: "循环关闭",
            type: "radio",
            checked: repeat === "off",
            click: () => this.setRepeat("off")
          },
          {
            label: "单曲循环",
            type: "radio",
            checked: repeat === "one",
            click: () => this.setRepeat("one")
          },
          {
            label: "列表循环",
            type: "radio",
            checked: repeat === "all",
            click: () => this.setRepeat("all")
          }
        ]
      },
      {
        label: "随机播放",
        type: "checkbox",
        checked: shuffle,
        enabled: shuffleEnabled,
        click: () => this.dispatchPlayer("shuffle-toggle")
      }
    ];
  }

  private static dispatchPlayer(action: "next" | "previous" | "play-toggle" | "shuffle-toggle") {
    MainIPC.MessageChannel.commit({
      sender: "process",
      receiver: "main",
      type: "bus_dispatch_player_action",
      data: action
    });
  }

  private static setRepeat(mode: RepeatMode) {
    MainIPC.MessageChannel.commit({
      sender: "process",
      receiver: "main",
      type: "bus_dispatch_player_action",
      data: { type: "repeat", mode }
    });
  }
}
