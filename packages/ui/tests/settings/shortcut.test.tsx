import { render, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { RendererFormat } from "@mahiru/ui/common/lib/format";
import { useKeyboardShortcut } from "@mahiru/ui/common/hooks/use-keyboard-shortcut";
import {
  type ShortcutBinding,
  type ShortcutBindingMap,
  RendererShortcutConstants
} from "@mahiru/ui/common/constants/shortcut";
import Shortcut from "@mahiru/ui/common/components/page/settings/content/shortcut";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/common/lib/device", () => ({ RendererDevice: { platform: Promise.resolve("darwin") } }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: showToast } }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("shows native Mac modifier names and preserves Windows labels", () => {
  const shortcut: ShortcutBinding = {
    key: "P",
    modifiers: ["ctrl", "shift", "alt", "meta"]
  };
  expect(RendererFormat.shortcut(shortcut, "darwin")).toBe(
    "Control + Shift + Option + Command + P"
  );
  expect(RendererFormat.shortcut(shortcut, "win32")).toBe("Ctrl + Shift + Alt + Win + P");

  const view = render(
    <Shortcut patchSettings={vi.fn()} data={RendererShortcutConstants.defaultBindings} />
  );
  expect(view.getByRole("button", { name: "修改切换播放页快捷键" })).toHaveTextContent(
    "Option + P"
  );
  expect(view.getByRole("button", { name: "修改上一首快捷键" })).toHaveTextContent("Option + ←");
});

it.each([
  ["π", "KeyP", "P", false],
  ["Dead", "KeyE", "E", false],
  ["¡", "Digit1", "1", false],
  ["∏", "KeyP", "P", true]
])("records Option combinations by their base key (%s)", (key, code, expectedKey, shiftKey) => {
  const patchSettings = vi.fn();
  const callback = vi.fn();
  renderHook(() =>
    useKeyboardShortcut([
      { ...RendererShortcutConstants.defaultBindings.playModalToggle, callback }
    ])
  );
  const data = RendererShortcutConstants.defaultBindings;
  const view = render(<Shortcut data={data} patchSettings={patchSettings} />);
  fireEvent.click(view.getByRole("button", { name: "修改切换播放页快捷键" }));
  fireEvent.keyDown(window, { key, code, altKey: true, shiftKey });

  expect(patchSettings).toHaveBeenCalledExactlyOnceWith({
    shortcuts: {
      ...data,
      playModalToggle: { key: expectedKey, modifiers: shiftKey ? ["shift", "alt"] : ["alt"] }
    }
  });
  expect(callback).not.toHaveBeenCalled();
  expect(view.getByRole("button", { name: "修改切换播放页快捷键" })).not.toHaveTextContent(
    "按下新的快捷键"
  );
});

it.each(["P", "π"])("detects conflicts with existing Option bindings (%s)", (key) => {
  const patchSettings = vi.fn();
  const data = RendererShortcutConstants.defaultBindings;
  data.playModalToggle = { key, modifiers: ["alt"] };
  const view = render(<Shortcut data={data} patchSettings={patchSettings} />);
  fireEvent.click(view.getByRole("button", { name: "修改静音/取消静音快捷键" }));
  fireEvent.keyDown(window, { key: "π", code: "KeyP", altKey: true });

  expect(patchSettings).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledExactlyOnceWith({
    type: "error",
    text: "与「切换播放页」的快捷键冲突"
  });
});

it("waits for a main key, ignores composition and supports Command bindings", () => {
  const patchSettings = vi.fn();
  const data = RendererShortcutConstants.defaultBindings;
  const view = render(<Shortcut data={data} patchSettings={patchSettings} />);
  const button = view.getByRole("button", { name: "修改切换播放页快捷键" });
  fireEvent.click(button);
  fireEvent.keyDown(window, { key: "Meta", code: "MetaLeft", metaKey: true });
  fireEvent.keyDown(window, { key: "p", code: "KeyP", isComposing: true });
  fireEvent.keyDown(window, { key: "Dead", code: "Quote" });
  expect(patchSettings).not.toHaveBeenCalled();
  expect(button).toHaveTextContent("按下新的快捷键");

  fireEvent.keyDown(window, { key: "p", code: "KeyP", metaKey: true });
  const shortcuts: ShortcutBindingMap = {
    ...data,
    playModalToggle: { key: "p", modifiers: ["meta"] }
  };
  expect(patchSettings).toHaveBeenCalledExactlyOnceWith({ shortcuts });
  view.rerender(<Shortcut data={shortcuts} patchSettings={patchSettings} />);
  expect(button).toHaveTextContent("Command + P");
});

it("cancels recording with Escape and restores the portable defaults", () => {
  const patchSettings = vi.fn();
  const view = render(
    <Shortcut patchSettings={patchSettings} data={RendererShortcutConstants.defaultBindings} />
  );
  const button = view.getByRole("button", { name: "修改切换播放页快捷键" });
  fireEvent.click(button);
  fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
  expect(patchSettings).not.toHaveBeenCalled();
  expect(button).toHaveTextContent("Option + P");

  fireEvent.click(button);
  fireEvent.click(view.getByRole("button", { name: "恢复" }));
  expect(patchSettings).toHaveBeenCalledExactlyOnceWith({
    shortcuts: RendererShortcutConstants.defaultBindings
  });
  expect(button).toHaveTextContent("Option + P");
});
