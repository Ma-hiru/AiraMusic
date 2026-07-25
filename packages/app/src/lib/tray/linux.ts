import { Tray } from "electron";
import { MainIPC } from "@mahiru/ipc/main";
import type { MessageData } from "@mahiru/ipc/types";

import { TrayUtils } from "./utils";

export class LinuxTray extends TrayUtils {
  private playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;

  constructor(tray: Tray) {
    super(tray);

    const showMenu = (playerBus: Nullable<MessageData<"bus_deliver_track_meta">>) => {
      this.playerBus = playerBus;
      this.showRawMenu({
        setMenu: (menu) => tray.setContextMenu(menu),
        getData: () => this.playerBus
      });
    };

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", showMenu);

    showMenu(null);
  }
}
