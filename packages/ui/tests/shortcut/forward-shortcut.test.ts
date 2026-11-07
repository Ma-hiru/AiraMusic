import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererIPCMessageBus } from "@mahiru/ui/common/lib/bus";
import { RendererShortcutConstants } from "@mahiru/ui/common/constants/shortcut";
import { useShortcutForwarder } from "@mahiru/ui/common/hooks/use-shortcut-forwarder";

const send = vi.mocked(RendererIPC.MessageChannel.send);
const forwardedActions = () =>
  send.mock.calls
    .filter(([type]) => type === "bus_dispatch_shortcut")
    .map(([, , action]) => action);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("forwards only keys bound to a shortcut in the current settings", () => {
  renderHook(() => useShortcutForwarder());

  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(forwardedActions()).toEqual(["playToggle"]);
  expect(send).toHaveBeenLastCalledWith("bus_dispatch_shortcut", "main", "playToggle");

  send.mockClear();
  for (const key of ["a", "Enter", "Escape", "Tab", "F5"]) {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  }
  expect(forwardedActions()).toEqual([]);
});

it("maps configured bindings to their own actions and keeps the native default", () => {
  renderHook(() => useShortcutForwarder());

  const event = new KeyboardEvent("keydown", {
    key: "π",
    code: "KeyP",
    altKey: true,
    bubbles: true,
    cancelable: true
  });
  fireEvent(window, event);

  expect(forwardedActions()).toEqual(["playModalToggle"]);
  expect(event.defaultPrevented).toBe(true);
});

it.each([
  ["input", "input"],
  ["textarea", "textarea"],
  ["select", "select"],
  ["contenteditable", "div"],
  ["textbox", "div"]
])("does not take over typing inside %s", (kind, tag) => {
  renderHook(() => useShortcutForwarder());
  const editor = document.createElement(tag);
  if (kind === "contenteditable") editor.setAttribute("contenteditable", "true");
  if (kind === "textbox") editor.setAttribute("role", "textbox");
  document.body.appendChild(editor);

  fireEvent.keyDown(editor, { key: " ", code: "Space", bubbles: true });

  expect(forwardedActions()).toEqual([]);
  editor.remove();

  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(forwardedActions()).toEqual(["playToggle"]);
});

it("ignores composition input and events already handled by the page", () => {
  renderHook(() => useShortcutForwarder());

  fireEvent.keyDown(window, { key: " ", code: "Space", isComposing: true });
  const handled = new KeyboardEvent("keydown", {
    key: " ",
    code: "Space",
    bubbles: true,
    cancelable: true
  });
  handled.preventDefault();
  fireEvent(window, handled);

  expect(forwardedActions()).toEqual([]);
});

it("stays silent when disabled and stops forwarding after unmount", () => {
  const { unmount, rerender } = renderHook(
    ({ enabled }: { enabled: boolean }) => useShortcutForwarder({ enabled }),
    { initialProps: { enabled: false } }
  );
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(forwardedActions()).toEqual([]);

  rerender({ enabled: true });
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(forwardedActions()).toEqual(["playToggle"]);

  unmount();
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  expect(forwardedActions()).toEqual(["playToggle"]);
});

it("skips windows that execute shortcuts themselves or have no player context", () => {
  expect(RendererShortcutConstants.canForwardShortcut("lyric")).toBe(true);
  expect(RendererShortcutConstants.canForwardShortcut("miniplayer")).toBe(true);
  expect(RendererShortcutConstants.canForwardShortcut("tray")).toBe(true);
  expect(RendererShortcutConstants.canForwardShortcut("main")).toBe(false);
  expect(RendererShortcutConstants.canForwardShortcut("login")).toBe(false);
  expect(RendererShortcutConstants.canForwardShortcut("external")).toBe(false);
});

it("main only accepts forwarded shortcuts from other renderer windows", () => {
  const received: string[] = [];
  RendererIPCMessageBus.listenShortcut((action) => received.push(action));

  const listen = vi.mocked(RendererIPC.MessageChannel.listen);
  const handler = listen.mock.calls.findLast(
    ([type]) => type === "bus_dispatch_shortcut"
  )?.[2] as unknown as (message: { data: string; from: string; type: string }) => void;
  expect(handler).toBeTypeOf("function");

  handler({ from: "lyric", type: "bus_dispatch_shortcut", data: "playToggle" });
  handler({ from: "miniplayer", type: "bus_dispatch_shortcut", data: "nextTrack" });
  handler({ from: "process", type: "bus_dispatch_shortcut", data: "muteToggle" });
  handler({ from: "main", type: "bus_dispatch_shortcut", data: "volumeUp" });

  expect(received).toEqual(["playToggle", "nextTrack"]);
});
