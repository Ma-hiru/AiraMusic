import { act, cleanup, renderHook } from "@testing-library/react";
import { RendererWindow } from "@mahiru/ui/common/lib/window";
import { useWindowVisible } from "@mahiru/ui/common/hooks/use-window-visible";

const ipc = vi.hoisted(() => ({
  listeners: new Map<string, (data: { type: string; action: string }) => void>()
}));
vi.mock("@/common/lib/runtime", () => ({ RendererRuntime: { currentWindowType: "main" } }));
vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: {
    NormalChannel: { send: () => Promise.resolve(false) },
    MessageChannel: {
      listen: (
        name: string,
        _from: string,
        listener: (data: { type: string; action: string }) => void
      ) => {
        ipc.listeners.set(name, listener);
        return () => ipc.listeners.delete(name);
      },
      send: vi.fn(),
      remove: vi.fn()
    }
  }
}));

it("reacts to real RendererWindow IPC notifications without a manual component rerender", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    const { result } = renderHook(useWindowVisible);
    const send = async (...actions: string[]) => {
      await act(async () => {
        for (const action of actions)
          ipc.listeners.get("bus_deliver_window_event")!({ type: "main", action });
        await vi.advanceTimersByTimeAsync(150);
      });
    };
    await send("show");
    expect(result.current).toBe(true);
    await send("minimize", "hide", "blur");
    expect(RendererWindow.current.isMin).toBe(true);
    expect(RendererWindow.current.isShow).toBe(false);
    expect(result.current).toBe(false);
    await send("unminimize", "show", "focus");
    expect(result.current).toBe(true);
    await send("hide");
    expect(result.current).toBe(false);
  } finally {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
