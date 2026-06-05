import { vi } from "vitest";

export const RendererIPC = {
  Event: vi.fn(),
  Invoke: () => {
    return Promise.resolve();
  },
  Message: vi.mockObject({
    listen: vi.fn(),
    send: vi.fn()
  }),
  _init: vi.fn()
};
