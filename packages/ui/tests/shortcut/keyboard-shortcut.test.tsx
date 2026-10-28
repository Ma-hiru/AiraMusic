import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { useKeyboardShortcut } from "@mahiru/ui/common/hooks/use-keyboard-shortcut";
import {
  type ShortcutBinding,
  RendererShortcutConstants
} from "@mahiru/ui/common/constants/shortcut";

afterEach(cleanup);

it.each([
  [
    { key: "π", code: "KeyP", altKey: true },
    { key: "P", modifiers: ["alt"] }
  ],
  [
    { key: "p", code: "KeyP", altKey: true },
    { key: "P", modifiers: ["alt"] }
  ],
  [
    { key: "∏", code: "KeyP", altKey: true, shiftKey: true },
    { key: "P", modifiers: ["alt", "shift"] }
  ],
  [
    { key: "Dead", code: "KeyE", altKey: true },
    { key: "E", modifiers: ["alt"] }
  ],
  [
    { key: "¡", code: "Digit1", altKey: true },
    { key: "1", modifiers: ["alt"] }
  ],
  [
    { key: "ArrowLeft", code: "ArrowLeft", altKey: true },
    { key: "ArrowLeft", modifiers: ["alt"] }
  ],
  [
    { key: "p", code: "KeyP", metaKey: true },
    { key: "P", modifiers: ["meta"] }
  ],
  [
    { key: "π", code: "KeyP", altKey: true },
    { key: "π", modifiers: ["alt"] }
  ],
  [
    { key: "!", code: "Digit1", shiftKey: true },
    { key: "!", modifiers: ["shift"] }
  ]
] satisfies [KeyboardEventInit, ShortcutBinding][])(
  "triggers a matching portable or existing custom binding (%j)",
  (init, binding) => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut([{ ...binding, callback }]));
    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(callback).toHaveBeenCalledExactlyOnceWith(event);
    expect(event.defaultPrevented).toBe(true);
  }
);

it.each([
  { key: "p", code: "KeyP" },
  { key: "p", code: "KeyP", metaKey: true },
  { key: "∏", code: "KeyP", altKey: true, shiftKey: true },
  { key: "π", code: "KeyP", altKey: true, ctrlKey: true },
  { key: "π", code: "KeyP", altKey: true, isComposing: true },
  { key: "Process", code: "KeyP", altKey: true },
  { key: "Alt", code: "AltLeft", altKey: true }
])("ignores incorrect modifiers, composition and modifier-only events (%j)", (init) => {
  const callback = vi.fn();
  renderHook(() =>
    useKeyboardShortcut([
      { ...RendererShortcutConstants.defaultBindings.playModalToggle, callback }
    ])
  );
  const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
  fireEvent(window, event);
  expect(callback).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
});

it("updates custom bindings immediately and removes the listener on unmount", () => {
  const callback = vi.fn();
  const { unmount, rerender } = renderHook(
    ({ binding }: { binding: ShortcutBinding }) => useKeyboardShortcut([{ ...binding, callback }]),
    { initialProps: { binding: RendererShortcutConstants.defaultBindings.playModalToggle } }
  );
  rerender({ binding: { key: "P", modifiers: ["meta"] } });
  fireEvent.keyDown(window, { key: "π", code: "KeyP", altKey: true });
  expect(callback).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "p", code: "KeyP", metaKey: true });
  expect(callback).toHaveBeenCalledOnce();
  unmount();
  fireEvent.keyDown(window, { key: "p", code: "KeyP", metaKey: true });
  expect(callback).toHaveBeenCalledOnce();
});

it.each(["input", "textarea", "select", "contenteditable", "textbox"])(
  "leaves Option input untouched in %s when the global shortcut opts out of editors",
  (kind) => {
    const callback = vi.fn();
    renderHook(() =>
      useKeyboardShortcut([{ key: "P", modifiers: ["alt"], callback }], {
        ignoreEditable: true
      })
    );
    const editor = document.createElement(
      ["contenteditable", "textbox"].includes(kind) ? "div" : kind
    );
    if (kind === "contenteditable") editor.setAttribute("contenteditable", "true");
    if (kind === "textbox") editor.setAttribute("role", "textbox");
    const target =
      kind === "contenteditable" ? editor.appendChild(document.createElement("span")) : editor;
    document.body.appendChild(editor);
    const event = new KeyboardEvent("keydown", {
      key: "π",
      code: "KeyP",
      altKey: true,
      bubbles: true,
      cancelable: true
    });
    fireEvent(target, event);
    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    editor.remove();
    fireEvent.keyDown(window, { key: "π", code: "KeyP", altKey: true });
    expect(callback).toHaveBeenCalledOnce();
  }
);

it("preserves component-local shortcuts inside inputs by default", () => {
  const callback = vi.fn();
  renderHook(() => useKeyboardShortcut([{ key: "Enter", callback }]));
  const input = document.body.appendChild(document.createElement("input"));
  fireEvent.keyDown(input, { key: "Enter", bubbles: true });
  expect(callback).toHaveBeenCalledOnce();
  input.remove();
});
