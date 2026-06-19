import { vi } from "vitest";

export function init() {}

export const RendererIPC = {
  NormalChannel: {
    send: () => Promise.resolve()
  },
  MessageChannel: vi.mockObject({
    listen: vi.fn(),
    send: vi.fn()
  }),
  _init: vi.fn()
};
