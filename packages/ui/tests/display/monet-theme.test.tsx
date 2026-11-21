import { cleanup, renderHook } from "@testing-library/react";
import { applyMonetPalette, type MonetPalettes } from "@mahiru/ui/common/player/monet";
import { useThemeInjectFromBus } from "@mahiru/ui/common/hooks/use-theme-inject-from-bus";
import type { MessageData } from "@mahiru/ipc/types";

const { bus } = vi.hoisted(() => ({
  bus: {
    theme: { data: null as Nullable<MessageData<"bus_deliver_theme">> },
    updater: { deliver: vi.fn() }
  }
}));

vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: bus }));
vi.mock("@/common/lib/window", () => ({ RendererWindow: { current: { isMainWindow: false } } }));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
});

it("clears the received cover colors when the next theme falls back to the default palette", () => {
  bus.theme.data = {
    backgroundCover: "cover-blue",
    theme: {
      mainColor: "#4193ed",
      themeColors: ["#4193ed"],
      palette: { primary: { 60: "#4193ed", 70: "#6daeff" }, neutral: { 95: "#f1f0f4" } }
    }
  };
  const { rerender } = renderHook(() => useThemeInjectFromBus());
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--m3-primary-60")).toBe("#4193ed");
  expect(style.getPropertyValue("--m3-primary-70")).toBe("#6daeff");
  expect(style.getPropertyValue("--m3-neutral-95")).toBe("#f1f0f4");

  bus.theme.data = {
    backgroundCover: undefined,
    theme: { mainColor: "#ff5358", themeColors: [] }
  };
  rerender();
  expect(style.getPropertyValue("--m3-primary-60")).toBe("");
  expect(style.getPropertyValue("--m3-primary-70")).toBe("");
  expect(style.getPropertyValue("--m3-neutral-95")).toBe("");
});

it("applies and clears a resource palette without changing the window palette", () => {
  const page = document.createElement("div");
  const windowStyle = document.documentElement.style;
  windowStyle.setProperty("--m3-primary-60", "#4193ed");
  const resourcePalette = { primary: { 60: "#d4793a" } } as MonetPalettes;

  applyMonetPalette(resourcePalette, page.style);
  expect(page.style.getPropertyValue("--m3-primary-60")).toBe("#d4793a");
  expect(windowStyle.getPropertyValue("--m3-primary-60")).toBe("#4193ed");

  applyMonetPalette(null, page.style);
  expect(page.style.getPropertyValue("--m3-primary-60")).toBe("");
  expect(windowStyle.getPropertyValue("--m3-primary-60")).toBe("#4193ed");
});
