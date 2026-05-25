import { MainMessageChannel, type MessageData } from "@mahiru/ipc/main";
import {
  BrowserWindow,
  clipboard,
  Menu,
  MenuItem,
  type MenuItemConstructorOptions,
  nativeImage,
  screen,
  Tray
} from "electron";
import { MainWindowManager } from "@/lib/window-manager";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowCreator } from "@/lib/window-creator";
import { Log } from "@/lib/log";
import { MainWindowPreset } from "@/lib/window-preset";

export class MainTray {
  static register() {
    Log.debug("registerTray");
    if (!MainWindowManager.getTray()) {
      this.createMenu(MainWindowManager.initTray(this.createIcon()));
    }
  }

  private static playerBus: Nullable<MessageData<"playerBus">> = null;

  private static createIcon() {
    return nativeImage.createFromPath(MainPathResolver.appLogoPath);
  }

  private static createMenu(tray: Tray) {
    if (process.platform === "linux") {
      this.showRawMenu(tray);
      MainMessageChannel.listen("playerBus", (data) => {
        this.playerBus = data;
        this.showRawMenu(tray);
      });
    } else {
      const trayWin =
        MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnWindows)!;
      tray.addListener("click", () => {
        Log.debug("tray", "click");
        MainWindowManager.checkAndShow("main");
      });
      tray.addListener("double-click", () => {
        Log.debug("tray", "double-click");
        MainWindowManager.checkAndShow("main");
      });
      tray.addListener("right-click", () => {
        Log.debug("tray", "right-click");
        this.showCustomMenu(tray, trayWin);
      });
      trayWin.addListener("blur", () => {
        if (!trayWin.webContents.isDevToolsOpened()) {
          trayWin.isVisible() && trayWin.hide();
        }
      });
      trayWin.webContents.addListener("before-input-event", (_, input) => {
        if (input.key === "Escape") trayWin.hide();
      });
    }

    tray.setToolTip(process.env.APP_NAME);
    MainMessageChannel.listen("playerBus", (data) => {
      const track = data.track?.detail;
      track?.name
        ? tray.setToolTip(`${process.env.APP_NAME} - ${track.name}`)
        : tray.setToolTip(process.env.APP_NAME);
    });
  }

  private static showRawMenu(tray: Tray) {
    Log.debug("tray", "create raw menu");
    const items: (MenuItem | MenuItemConstructorOptions)[] = [
      {
        label: this.playerBus?.status === "playing" ? "暂停" : "播放",
        click: () => {
          MainMessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
            data: this.playerBus?.status === "playing" ? "pause" : "play"
          });
          this.showRawMenu(tray);
        }
      },
      {
        label: "上一首",
        click: () => {
          MainMessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
            data: "previous"
          });
        }
      },
      {
        label: "下一首",
        click: () => {
          MainMessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
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
              const open = () => {
                setTimeout(() => {
                  MainMessageChannel.commit({
                    sender: "process",
                    receiver: "comments",
                    type: "commentBus",
                    data: {
                      id: track.id,
                      type: "track"
                    }
                  });
                }, 1500);
              };
              if (!MainWindowManager.has("comments")) {
                MainWindowCreator.create(MainWindowPreset.get("comments"))?.once("show", open);
              } else {
                open();
              }
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
          }
        },
        {
          label: "退出",
          click: () => {
            MainMessageChannel.commit({
              sender: "process",
              receiver: "main",
              type: "playerActionBus",
              data: "exit"
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

    trayWin.setPosition(x, y, false);
    !trayWin.isVisible() && trayWin.show();
    trayWin.focus();
  }
}
