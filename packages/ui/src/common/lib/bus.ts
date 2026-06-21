import { Listenable } from "@/common/utils/listenable";
import { RendererIPC } from "@mahiru/ipc/renderer";
import type { MessageBusEvent, MessageData } from "@mahiru/ipc/types";

export abstract class MessageBus<
  T extends MessageBusEvent,
  D extends "arr" | "obj" = "obj"
> extends Listenable {
  readonly type: T;
  protected readonly defaultTarget;
  private readonly unsubscriber;

  protected constructor(type: T, defaultTarget: WindowType | WindowType[] = "all") {
    super();
    this.type = type;
    this.defaultTarget = defaultTarget;
    this.unsubscriber = RendererIPC.MessageChannel.listen(type, "all", ({ data }) => {
      this.append(data);
      this.executeListeners();
    });
  }

  static _consume(bus: MessageBus<any>, flush = false) {
    const data = bus.data;
    bus.clear();
    flush && bus.executeListeners();
    return data;
  }

  deliver(data: MessageData<T>, target = this.defaultTarget) {
    const targets = Array.isArray(target) ? target : [target];
    for (const t of targets) {
      RendererIPC.MessageChannel.send(this.type, t, data);
    }
  }

  twoWay(data: MessageData<T>, target = this.defaultTarget) {
    this.deliver(data, target);
    this.dispatch(data);
  }

  dispatch(data: MessageData<T>) {
    this.append(data);
    this.executeListeners();
  }

  override [Symbol.dispose]() {
    this.unsubscriber();
    this.clear();
    super[Symbol.dispose]();
  }

  abstract data: D extends "obj" ? Nullable<MessageData<T>> : MessageData<T>[];
  protected abstract append(data: MessageData<T>): void;
  protected abstract clear(): void;
}

export class MessageBusObj<T extends MessageBusEvent> extends MessageBus<T> {
  data: Nullable<MessageData<T>> = null;

  constructor(type: T, defaultTarget: WindowType | WindowType[] = "all") {
    super(type, defaultTarget);
  }

  protected override append(data: MessageData<T>) {
    this.data = data;
  }

  protected override clear() {
    this.data = null;
  }
}

export class MessageBusArray<T extends MessageBusEvent> extends MessageBus<T, "arr"> {
  data: MessageData<T>[] = [];
  maxLen: number;

  constructor(type: T, defaultTarget: WindowType | WindowType[] = "all", maxLen = 10) {
    super(type, defaultTarget);
    this.maxLen = maxLen;
  }

  protected override append(data: MessageData<T>) {
    this.data = [...this.data.slice(0, this.maxLen - 1), data]; // 新引用
  }

  protected override clear() {
    this.data = [];
  }
}

/**
 * 对 ipc message 的 channel 单独封装
 * */
export class RendererIPCMessageBus {
  static readonly trackMeta = new MessageBusObj("bus_deliver_track_meta");
  static readonly progress = new MessageBusObj("bus_deliver_track_progress");
  static readonly theme = new MessageBusObj("bus_deliver_theme");
  static readonly comment = new MessageBusObj("bus_deliver_comment", "comments");
  static readonly updater = new MessageBusArray("bus_dispatch_update", "main");
  static readonly display = new MessageBusArray("bus_display", "display");
  static readonly playerAction = new MessageBusArray("bus_dispatch_player_action", "main");
  static readonly playlistAction = new MessageBusArray("bus_dispatch_playlist_action", "main");
  static readonly output = new MessageBusObj("bus_deliver_device_output_views", "display");
  static readonly history = new MessageBusObj("bus_deliver_history", "display");
  static readonly preview = new MessageBusArray("bus_deliver_preview", "image");
  static readonly modified = new MessageBusArray("bus_modify_source", ["main", "display"]);

  static consume(type: MessageBusEvent) {
    for (const ins of Object.values(this) as MessageBus<any>[]) {
      if (typeof ins === "object" && ins.type === type) {
        MessageBus._consume(ins);
      }
    }
  }
}
