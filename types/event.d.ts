type InvokeEventMaps = {
  message: [message: string, string];
};

type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "minimizeToTray";
  isMaximized: boolean;
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
