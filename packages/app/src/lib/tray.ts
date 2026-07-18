import { debounce } from "lodash-es";
import {
  Menu,
  Tray,
  screen,
  MenuItem,
  clipboard,
  nativeImage,
  BrowserWindow,
  type MenuItemConstructorOptions
} from "electron";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { MainIPC } from "@mahiru/ipc/main";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowConstants } from "@/constants/window";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import { MainExitCodeConstants } from "@/constants/exit-code";
import type { MessageData } from "@mahiru/ipc/types";

export class MainTray {
  static register() {
    Log.debug("registerTray");
    if (!MainWindowManager.getTray()) {
      this.createMenu(MainWindowManager.initTray(this.createIcon()));
    }
  }

  private static playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;
  private static customMenuVisible = false;

  private static createIcon() {
    if (process.platform === "darwin") return this.createDarwinIcon();
    return nativeImage.createFromPath(MainPathResolver.appLogoPath);
  }

  /**
   * macOS 菜单栏按图片的 point 尺寸渲染且不会自动缩放，
   * 512px 原图会被当作 512pt 直接撑爆菜单栏，
   * 需缩到 ~18pt 并附带 retina(@2x) 表示
   */
  private static createDarwinIcon() {
    const base = nativeImage.createFromPath(MainPathResolver.appLogoPath);
    const icon = nativeImage.createEmpty();
    icon.addRepresentation({
      scaleFactor: 1,
      buffer: base.resize({ width: 18, height: 18 }).toPNG()
    });
    icon.addRepresentation({
      scaleFactor: 2,
      buffer: base.resize({ width: 36, height: 36 }).toPNG()
    });
    return icon;
  }

  private static hideCustomMenu(trayWin: BrowserWindow) {
    if (!this.customMenuVisible) return;

    this.customMenuVisible = false;
    trayWin.setIgnoreMouseEvents(true);
    trayWin.setOpacity(0);
    trayWin.setPosition(
      MainWindowConstants.TRAY_HIDDEN_POINT.x,
      MainWindowConstants.TRAY_HIDDEN_POINT.y,
      false
    );
    trayWin.isFocused() && trayWin.blur();
  }

  private static createMenu(tray: Tray) {
    if (process.platform === "linux") {
      this.showRawMenu(tray);
      MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
        this.playerBus = data;
        this.showRawMenu(tray);
      });
    } else if (process.platform === "darwin") {
      this.createDarwinMenu(tray);
    } else {
      const trayWin =
        MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnWindows)!;
      const showMenu = () => this.showCustomMenu(tray, trayWin);
      const showMenuDebounced = debounce(showMenu, 300);
      tray.addListener("click", () => {
        Log.debug("tray", "click");
        showMenuDebounced();
      });
      tray.addListener("double-click", () => {
        Log.debug("tray", "double-click");
        showMenuDebounced.cancel();
        MainWindowManager.checkAndShow("main");
        MainWindowManager.get("miniplayer")?.hide();
      });
      tray.addListener("right-click", () => {
        Log.debug("tray", "right-click");
        showMenuDebounced.cancel();
        showMenu();
      });
      trayWin.addListener("blur", () => {
        if (!trayWin.webContents.isDevToolsOpened()) {
          this.hideCustomMenu(trayWin);
        }
      });
      trayWin.webContents.addListener("before-input-event", (_, input) => {
        if (input.key === "Escape") this.hideCustomMenu(trayWin);
      });
    }

    tray.setToolTip(process.env.APP_NAME);
    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      const track = data.track?.detail;
      track?.name
        ? tray.setToolTip(`${process.env.APP_NAME} - ${track.name}`)
        : tray.setToolTip(process.env.APP_NAME);
    });
  }

  private static createDarwinMenu(tray: Tray) {
    const trayWin =
      MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnDarwin)!;
    // macOS 菜单栏习惯：单击即弹出，再次单击收起，无需双击/防抖
    const toggleMenu = () => {
      this.customMenuVisible ? this.hideCustomMenu(trayWin) : this.showCustomMenu(tray, trayWin);
    };
    const bindToggle = (target: Tray, label: string) => {
      target.addListener("click", () => {
        Log.debug("tray", label, "click");
        toggleMenu();
      });
      target.addListener("right-click", () => {
        Log.debug("tray", label, "right-click");
        toggleMenu();
      });
    };
    // 图标 Tray 先创建（靠时钟一侧）；歌词 Tray 后创建（在图标左侧）。
    // 菜单栏 status item 后创建的会排在更靠左，因此布局为：[歌词][图标]…[时钟]
    bindToggle(tray, "icon");
    const lyricTray = this.ensureDarwinLyricTray();
    bindToggle(lyricTray, "lyric");
    trayWin.addListener("blur", () => {
      if (!trayWin.webContents.isDevToolsOpened()) {
        this.hideCustomMenu(trayWin);
      }
    });
    trayWin.webContents.addListener("before-input-event", (_, input) => {
      if (input.key === "Escape") this.hideCustomMenu(trayWin);
    });

    this.registerDarwinLyricTitle(lyricTray);
  }

  /**
   * 歌词单独占一个 status item：只显示文字、透明图标。
   * 这样歌词变长只会向左伸展，右侧图标位置固定，不会跟着乱动。
   */
  private static darwinLyricTray: Nullable<Tray> = null;
  private static ensureDarwinLyricTray() {
    if (this.darwinLyricTray) return this.darwinLyricTray;
    this.darwinLyricTray = new Tray(this.createTransparentDarwinIcon());
    this.darwinLyricTray.setIgnoreDoubleClickEvents(true);
    return this.darwinLyricTray;
  }

  /** 1×1 透明 PNG，避免歌词 Tray 再露出第二枚图标 */
  private static createTransparentDarwinIcon() {
    return nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5X1k0AAAAASUVORK5CYII="
    );
  }

  /** 菜单栏歌词 */
  private static readonly DARWIN_TITLE_MAX_LENGTH = 25;
  private static darwinTrayTitle = "";
  private static registerDarwinLyricTitle(lyricTray: Tray) {
    const applyTitle = (title: string) => {
      if (title === this.darwinTrayTitle) return;
      this.darwinTrayTitle = title;
      lyricTray.setTitle(title);
    };

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      this.playerBus = data;
      if (data.status !== "playing") applyTitle("");
    });
    MainIPC.MessageChannel.listen("bus_deliver_track_progress", (data) => {
      if (this.playerBus?.status !== "playing") return applyTitle("");
      // progress 单位为秒，歌词时间轴为毫秒
      const line = this.findLyricLine(this.playerBus.lyric, data.currentTime * 1000);
      applyTitle(line ? this.formatDarwinTitle(line) : "");
    });
  }

  /** 取最后一条已开始的主歌词行 */
  private static findLyricLine(lyric: Optional<NeteaseLyricModel>, timeMS: number) {
    const lines = lyric?.data;
    if (!lines?.length) return null;

    let current: Nullable<LyricLine> = null;
    for (const line of lines) {
      if (line.startTime > timeMS) break;
      if (line.isBlank || line.isBackChorus) continue;
      current = line;
    }
    return current;
  }

  private static formatDarwinTitle(line: LyricLine) {
    const text = line.words
      .filter((word) => !word.inlineNote)
      .map((word) => word.word)
      .join("")
      .trim();
    if (text.length <= this.DARWIN_TITLE_MAX_LENGTH) return text;
    return `${text.slice(0, this.DARWIN_TITLE_MAX_LENGTH - 1)}…`;
  }

  private static removeChecker: Nullable<NormalFunc> = null;
  private static previousResolve: Nullable<NormalFunc> = null;
  private static previousTimer: Nullable<NodeJS.Timeout> = null;
  private static openCommentReady(promise?: Promise<void>, resolve?: NormalFunc) {
    if (!promise || !resolve) {
      const newPromise = Promise.withResolvers<void>();
      promise = newPromise.promise;
      resolve = newPromise.resolve;
    }

    const commentWin = MainWindowManager.get("comments");
    if (commentWin) {
      this.removeChecker?.();
      this.previousResolve?.();
      this.previousTimer && clearTimeout(this.previousTimer);

      this.previousResolve = resolve;
      this.previousTimer = setTimeout(() => {
        this.removeChecker?.();
        this.previousResolve?.();
        this.removeChecker = null;
        this.previousResolve = null;
        this.previousTimer = null;
      }, 5000);
      this.removeChecker = MainIPC.MessageChannel.addForwardChecker((win, message) => {
        if (
          MainWindowManager.getId(win) === "comments" &&
          message.type === "bus_deliver_react_ready" &&
          (message.data as MessageData<"bus_deliver_react_ready">).type === "ready"
        ) {
          this.previousTimer && clearTimeout(this.previousTimer);
          this.removeChecker?.();
          this.removeChecker = null;
          this.previousResolve = null;
          resolve();
        }
        return true;
      });

      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "comments",
        type: "bus_deliver_react_ready",
        data: {
          type: "isReady",
          target: "comments"
        }
      });
    } else {
      MainWindowCreator.create(MainWindowPreset.get("comments"))?.once("ready-to-show", () =>
        this.openCommentReady(promise, resolve)
      );
    }

    return promise;
  }

  private static showRawMenu(tray: Tray) {
    Log.debug("tray", "create raw menu");
    const items: (MenuItem | MenuItemConstructorOptions)[] = [
      {
        label: this.playerBus?.status === "playing" ? "暂停" : "播放",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: this.playerBus?.status === "playing" ? "pause" : "play"
          });
          this.showRawMenu(tray);
        }
      },
      {
        label: "上一首",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: "previous"
          });
        }
      },
      {
        label: "下一首",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: "next"
          });
        }
      }
    ];
    if (this.playerBus) {
      items.push(
        ...[
          {
            label: "评论",
            click: () => {
              const track = this.playerBus?.track;
              if (!track) return;
              this.openCommentReady().then(() => {
                MainIPC.MessageChannel.commit({
                  sender: "process",
                  receiver: "comments",
                  type: "bus_deliver_comment",
                  data: {
                    id: track.id,
                    type: "track"
                  }
                });
              });
            }
          },
          {
            label: "复制",
            submenu: [
              {
                label: "复制歌名",
                click: () => {
                  this.playerBus?.track && clipboard.writeText(this.playerBus.track.name);
                }
              },
              {
                label: "复制歌手名",
                click: () => {
                  this.playerBus?.track?.detail &&
                    clipboard.writeText(
                      this.playerBus.track.detail.ar.map((a) => a.name).join("&")
                    );
                }
              },
              {
                label: "复制专辑名",
                click: () => {
                  this.playerBus?.track?.detail &&
                    clipboard.writeText(this.playerBus.track?.detail.al.name);
                }
              }
            ]
          }
        ]
      );
    }
    items.push(
      ...[
        {
          label: "显示",
          click: () => {
            MainWindowManager.checkAndShow("main");
            MainWindowManager.get("miniplayer")?.hide();
          }
        },
        {
          label: "退出",
          click: () => {
            MainIPC.MessageChannel.commit({
              sender: "process",
              receiver: "main",
              type: "bus_dispatch_player_action",
              data: "exit"
            });
            setTimeout(() => {
              const app = MainHandle.get();
              app?.exit(MainExitCodeConstants.NORMAL_EXIT, "user exit");
            });
          }
        }
      ]
    );
    const menu = Menu.buildFromTemplate(items);

    tray.setContextMenu(menu);
  }

  private static showCustomMenu(tray: Tray, trayWin: BrowserWindow) {
    const trayBounds = tray.getBounds();
    const winBounds = trayWin.getBounds();
    const workArea = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y
    }).workArea;
    const trayCenterX = trayBounds.x + trayBounds.width / 2;
    const isTop = trayBounds.y < workArea.y + workArea.height / 2;

    let x = Math.round(trayCenterX - winBounds.width / 2); // 水平居中对齐
    if (x + winBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - winBounds.width - 8;
    }
    if (x < workArea.x) {
      x = workArea.x + 8;
    }

    let y = isTop ? trayBounds.y + trayBounds.height + 4 : trayBounds.y - winBounds.height - 4;
    if (y + winBounds.height > workArea.y + workArea.height) {
      y = trayBounds.y - winBounds.height - 4;
    }
    if (y < workArea.y) {
      y = trayBounds.y + trayBounds.height + 4;
    }

    if (!this.customMenuVisible) trayWin.setOpacity(0);
    trayWin.setIgnoreMouseEvents(false);
    trayWin.setPosition(x, y, false);
    if (!trayWin.isVisible()) trayWin.show();
    trayWin.focus();
    trayWin.setOpacity(1);
    this.customMenuVisible = true;
  }
}
