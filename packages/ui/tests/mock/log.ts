import { vi } from "vitest";

export const Log = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  trace: vi.fn(),
  warn: vi.fn()
};

export function resetLogMock() {
  for (const mock of Object.values(Log)) {
    mock.mockClear();
  }
}
