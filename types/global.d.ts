declare global {
  interface Window {
    node: {
      invoke: RenderInvokeAPI;
      event: RenderEventAPI;
      register: NormalEventRegister;
    };
  }
}
export {};
