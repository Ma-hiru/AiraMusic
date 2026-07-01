import type { Message, MessageDirection } from "./message";
import type { NormalEvent, NormalEventArgs } from "./event";
import type { InvokeEvent, InvokeEventArgs, InvokeEventPayload } from "./invoke";

export type RendererEventSender = <E extends NormalEvent>(
  event: E,
  payload: NormalEventArgs<E>
) => void;

export type RendererInvokeSender = <E extends InvokeEvent>(
  event: E,
  arg: InvokeEventArgs<E>
) => Promise<InvokeEventPayload<E>>;

export type Api = {
  event: RendererEventSender;
  invoke: RendererInvokeSender;
  message: {
    send: NormalFunc<[message: Message<any, MessageDirection["send"]>]>;
    listen: (cb: NormalFunc<[data: Message<any, MessageDirection["receive"]>]>) => void;
  };
};
