import { ApiKey } from "../constants/preload";
import type { Api } from "../types/preload";
import type { NormalEvent, NormalEventArgs } from "../types/event";
import type { InvokeEvent, InvokeEventArgs, InvokeEventPayload } from "../types/invoke";

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

type SendData<T extends NormalEvent | InvokeEvent> = T extends NormalEvent
  ? NormalEventArgs<T>
  : T extends InvokeEvent
    ? InvokeEventArgs<T>
    : never;

type SendReturn<T extends NormalEvent | InvokeEvent> = T extends InvokeEvent
  ? Promise<InvokeEventPayload<T>>
  : void;

export class NormalChannel {
  private static assertEventChannel(channel: string): channel is NormalEvent {
    return channel.startsWith("event_");
  }

  private static assertInvokeChannel(channel: string): channel is InvokeEvent {
    return channel.startsWith("invoke_");
  }

  static send<const T extends NormalEvent | InvokeEvent>(
    name: T,
    data: SendData<T>
  ): SendReturn<T> {
    let result;

    if (this.assertEventChannel(name)) {
      API.event(name, data as NormalEventArgs<NormalEvent>);
    } else if (this.assertInvokeChannel(name)) {
      result = API.invoke(name, data as InvokeEventArgs<typeof name>) as SendReturn<T>;
    }

    return result as SendReturn<T>;
  }
}
