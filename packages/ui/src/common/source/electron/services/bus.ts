import { Listenable } from "@/common/utils/listenable";
import type { MessageEvent, MessageData } from "@mahiru/ipc/renderer";
import _AppWindow from "@/common/source/electron/services/window";

export abstract class Bus<T extends MessageEvent> extends Listenable {
  type: T;
  data: Nullable<MessageData<T>> = null;

  protected constructor(type: T) {
    super();
    this.type = type;
    _AppWindow.all.listenMessageAll(type, ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageData<T>) {
    _AppWindow.all.send(this.type, data);
  }

  commit(data: MessageData<T>) {
    this.data = data;
    this.executeListeners();
  }
}

export abstract class BusArray<T extends MessageEvent> extends Listenable {
  type: T;
  data: MessageData<T>[] = [];

  protected constructor(type: T) {
    super();
    this.type = type;
    _AppWindow.all.listenMessageAll(type, ({ data }) => {
      this.data = [...this.data, data];
      this.executeListeners();
    });
  }

  send(data: MessageData<T>) {
    _AppWindow.main.send(this.type, data);
  }
}

class AppPlayerBus extends Bus<"playerBus"> {
  constructor() {
    super("playerBus");
  }
}

class AppProgressBus extends Bus<"progressBus"> {
  constructor() {
    super("progressBus");
  }
}

class AppInfoBus extends Bus<"infoBus"> {
  constructor() {
    super("infoBus");
  }
}

class AppCommentsBus extends Bus<"commentBus"> {
  constructor() {
    super("commentBus");
  }
}

class AppPlayerActionBus extends BusArray<"playerActionBus"> {
  constructor() {
    super("playerActionBus");
  }
}

class AppUpdateMainBus extends BusArray<"updateBus"> {
  constructor() {
    super("updateBus");
  }
}

class AppDisplayBus extends Bus<"displayBus"> {
  constructor() {
    super("displayBus");
  }
}

class AppPlayerChangeBus extends BusArray<"playerChangeBus"> {
  constructor() {
    super("playerChangeBus");
  }
}

export default class _AppBus {
  private static readonly BusCollections = {
    playerBus: new AppPlayerBus(),
    progressBus: new AppProgressBus(),
    infoBus: new AppInfoBus(),
    commentBus: new AppCommentsBus(),
    playerActionBus: new AppPlayerActionBus(),
    updateMainBus: new AppUpdateMainBus(),
    displayBUs: new AppDisplayBus(),
    playerChangeBus: new AppPlayerChangeBus()
  };

  static get player() {
    return _AppBus.BusCollections.playerBus;
  }

  static get progress() {
    return _AppBus.BusCollections.progressBus;
  }

  static get info() {
    return _AppBus.BusCollections.infoBus;
  }

  static get comment() {
    return _AppBus.BusCollections.commentBus;
  }

  static get mainBusUpdater() {
    return _AppBus.BusCollections.updateMainBus;
  }

  static get playerAction() {
    return _AppBus.BusCollections.playerActionBus;
  }

  static get display() {
    return _AppBus.BusCollections.displayBUs;
  }

  static get playerChange() {
    return _AppBus.BusCollections.playerChangeBus;
  }

  static get collections() {
    return Object.entries(_AppBus.BusCollections).map(([, bus]) => bus);
  }

  static clear<T extends MessageEvent>(type: T) {
    for (const bus of _AppBus.collections) {
      if (bus.type === type) {
        if (Array.isArray(bus.data)) return (bus.data = []);
        if (typeof bus.data === "object") return (bus.data = null);
        return;
      }
    }
  }
}
