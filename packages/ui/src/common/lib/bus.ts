import type { MessageData, MessageEvent } from "@mahiru/ipc/renderer";
import { Listenable } from "@/common/utils/listenable";
import { RendererWindow } from "@/common/lib/window";

export abstract class Bus<T extends MessageEvent> extends Listenable {
  type: T;
  data: Nullable<MessageData<T>> = null;

  protected constructor(type: T) {
    super();
    this.type = type;
    RendererWindow.all.listenMessageAll(type, ({ data }) => {
      this.data = data;
      this.executeListeners();
    });
  }

  send(data: MessageData<T>) {
    RendererWindow.all.send(this.type, data);
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
    RendererWindow.all.listenMessageAll(type, ({ data }) => {
      this.data = [...this.data, data];
      this.executeListeners();
    });
  }

  send(data: MessageData<T>) {
    RendererWindow.main.send(this.type, data);
  }
}

class PlayerBus extends Bus<"playerBus"> {
  constructor() {
    super("playerBus");
  }
}

class ProgressBus extends Bus<"progressBus"> {
  constructor() {
    super("progressBus");
  }
}

class InfoBus extends Bus<"infoBus"> {
  constructor() {
    super("infoBus");
  }
}

class CommentsBus extends Bus<"commentBus"> {
  constructor() {
    super("commentBus");
  }
}

class PlayerActionBus extends BusArray<"playerActionBus"> {
  constructor() {
    super("playerActionBus");
  }
}

class UpdateMainBus extends BusArray<"updateBus"> {
  constructor() {
    super("updateBus");
  }
}

class DisplayBus extends Bus<"displayBus"> {
  constructor() {
    super("displayBus");
  }
}

class PlayerChangeBus extends BusArray<"playerChangeBus"> {
  constructor() {
    super("playerChangeBus");
  }
}

export class RendererEventBus {
  private static readonly BusCollections = {
    playerBus: new PlayerBus(),
    progressBus: new ProgressBus(),
    infoBus: new InfoBus(),
    commentBus: new CommentsBus(),
    playerActionBus: new PlayerActionBus(),
    updateMainBus: new UpdateMainBus(),
    displayBUs: new DisplayBus(),
    playerChangeBus: new PlayerChangeBus()
  };

  static get player() {
    return RendererEventBus.BusCollections.playerBus;
  }

  static get progress() {
    return RendererEventBus.BusCollections.progressBus;
  }

  static get info() {
    return RendererEventBus.BusCollections.infoBus;
  }

  static get comment() {
    return RendererEventBus.BusCollections.commentBus;
  }

  static get mainBusUpdater() {
    return RendererEventBus.BusCollections.updateMainBus;
  }

  static get playerAction() {
    return RendererEventBus.BusCollections.playerActionBus;
  }

  static get display() {
    return RendererEventBus.BusCollections.displayBUs;
  }

  static get playerChange() {
    return RendererEventBus.BusCollections.playerChangeBus;
  }

  static get collections() {
    return Object.entries(RendererEventBus.BusCollections).map(([, bus]) => bus);
  }

  static clear<T extends MessageEvent>(type: T) {
    for (const bus of RendererEventBus.collections) {
      if (bus.type === type) {
        if (Array.isArray(bus.data)) return (bus.data = []);
        if (typeof bus.data === "object") return (bus.data = null);
        return;
      }
    }
  }
}
