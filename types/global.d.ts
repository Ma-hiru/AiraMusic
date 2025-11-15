declare global {
  interface Window {
    node: {
      invoke: Record<InvokeEvent, RenderInvokeEventHandler<InvokeEvent>>;
      event: Record<NormalEvent, RenderNormalEventHandler<NormalEvent>>;
    };
  }
}
export {};
