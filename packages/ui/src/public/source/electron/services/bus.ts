import { Listenable } from "@mahiru/ui/public/utils/listenable";
import _AppWindow from "@mahiru/ui/public/source/electron/services/window";

class AppPlayerBus extends Listenable {
  data: Nullable<MessageTypeMap["playerBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenAll("playerBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }
}

class AppProgressBus extends Listenable {
  data: Nullable<MessageTypeMap["progressBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenAll("progressBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }
}

class AppInfoBus extends Listenable {
  data: Nullable<MessageTypeMap["infoBus"]> = null;

  constructor() {
    super();
    _AppWindow.all.listenAll("infoBus", ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }
}

export default class _AppBus {
  private static _updater: Nullable<NormalFunc> = null;
  private static playerBus = new AppPlayerBus();
  private static progressBus = new AppProgressBus();
  private static infoBus = new AppInfoBus();

  static get player() {
    return _AppBus.playerBus;
  }

  static get progress() {
    return _AppBus.progressBus;
  }

  static get info() {
    return _AppBus.infoBus;
  }

  static get updater() {
    return _AppBus._updater;
  }

  static injectUpdater(updater: NormalFunc) {
    _AppBus._updater = updater;
  }
}
