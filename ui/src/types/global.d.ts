type InvokeEventMaps = {
  message: [message: string, string];
};

type NormalEventMaps = {
  log: number;
};

type NormalEvent = keyof NormalEventMaps;

type NormalEventPayload<T extends NormalEvent> = NormalEventMaps[T];

type InvokeEvent = keyof InvokeEventMaps;

type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];

type RenderInvokeEventHandler<T extends InvokeEvent> = (
  param: InvokeEventArgs<T>
) => Promise<InvokeEventPayload<T>>;

type RenderNormalEventHandler<T extends NormalEvent> = (param: NormalEventPayload<T>) => void;

declare global {
  interface Window {
    node: {
      invoke: Record<InvokeEvent, RenderInvokeEventHandler<InvokeEvent>>;
      event: Record<NormalEvent, RenderNormalEventHandler<NormalEvent>>;
    };
  }
}
export {};
