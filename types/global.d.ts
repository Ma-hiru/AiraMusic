declare global {
  interface Window {
    node: {
      invoke: RenderInvokeAPI;
      event: RenderEventAPI;
    };
    login: (cookies: string) => void;
  }
}
export {};
