declare global {
  interface Window {
    electron: {
      invoke: RendererInvokeAPI;
      event: RendererEventAPI;
    };
  }
}
export {};
