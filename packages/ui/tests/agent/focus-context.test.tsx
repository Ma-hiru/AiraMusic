import { act, cleanup, renderHook } from "@testing-library/react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { useAgentFocusCtx } from "@mahiru/ui/common/hooks/use-agent-focus-ctx";
import type { AgentFocusContext } from "@mahiru/ipc/types";

const focus = vi.hoisted(() => ({ listeners: new Set<() => void>() }));
vi.mock("@mahiru/ui/common/lib/window", () => ({
  RendererWindow: {
    current: {
      addEventListener: (_event: string, callback: () => void) => {
        focus.listeners.add(callback);
        return () => focus.listeners.delete(callback);
      }
    }
  }
}));

const send = vi.mocked(RendererIPC.MessageChannel.send);
const contexts = () =>
  send.mock.calls
    .filter(([type]) => type === "bus_deliver_focus_context")
    .map(([, , data]) => data);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("reports the active page and refreshes its latest data on focus", () => {
  const { unmount, rerender } = renderHook(
    ({ context }: { context: AgentFocusContext }) => useAgentFocusCtx(context, true),
    { initialProps: { context: { page: "album", id: 1, name: "加载中" } as AgentFocusContext } }
  );
  expect(contexts()).toEqual([{ page: "album", id: 1, name: "加载中" }]);
  rerender({ context: { page: "album", id: 1, name: "已加载专辑" } });
  send.mockClear();
  act(() => focus.listeners.forEach((callback) => callback()));
  expect(contexts()).toEqual([{ page: "album", id: 1, name: "已加载专辑" }]);
  unmount();
  expect(contexts().at(-1)).toEqual({ page: "hidden" });
  expect(focus.listeners.size).toBe(0);
});

it("clears the previous route when it becomes inactive and does not publish inactive pages", () => {
  const { rerender } = renderHook(
    ({ active }) => useAgentFocusCtx({ page: "search", keyword: "当前查询" }, active),
    { initialProps: { active: false } }
  );
  expect(contexts()).toEqual([]);
  rerender({ active: true });
  expect(contexts()).toEqual([{ page: "search", keyword: "当前查询" }]);
  rerender({ active: false });
  expect(contexts().at(-1)).toEqual({ page: "hidden" });
  expect(focus.listeners.size).toBe(0);
});

it("restores the page and keeps one focus subscription after StrictMode effect cleanup", () => {
  renderHook(() => useAgentFocusCtx({ page: "playlist", id: 2, source: "normal" }, true), {
    reactStrictMode: true
  });
  expect(contexts().at(-1)).toEqual({ page: "playlist", id: 2, source: "normal" });
  expect(focus.listeners.size).toBe(1);
});
