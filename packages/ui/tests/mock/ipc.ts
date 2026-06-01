import { vi } from "vitest";

export const RendererIPC = {
  Event: vi.fn(),
  Invoke: vi.fn(),
  Message: vi.mockObject({}),
  _init: vi.fn()
};
