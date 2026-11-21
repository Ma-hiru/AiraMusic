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
      palette: {
        primary: { 60: "#4193ed", 70: "#6daeff" },
        neutral: { 95: "#f1f0f4" },
        accent: { fill: "#4193ed", ink: "#000000", hover: "#6daeff", active: "#3284e0" }
      }
    }
  };
  const { rerender } = renderHook(() => useThemeInjectFromBus());
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--m3-primary-60")).toBe("#4193ed");
  expect(style.getPropertyValue("--m3-primary-70")).toBe("#6daeff");
  expect(style.getPropertyValue("--m3-neutral-95")).toBe("#f1f0f4");
  expect(style.getPropertyValue("--m3-accent-fill")).toBe("#4193ed");
  expect(style.getPropertyValue("--m3-accent-ink")).toBe("#000000");

  bus.theme.data = {
    backgroundCover: undefined,
    theme: { mainColor: "#ff5358", themeColors: [] }
  };
  rerender();
  expect(style.getPropertyValue("--m3-primary-60")).toBe("");
  expect(style.getPropertyValue("--m3-primary-70")).toBe("");
  expect(style.getPropertyValue("--m3-neutral-95")).toBe("");
  expect(style.getPropertyValue("--m3-accent-fill")).toBe("");
  expect(style.getPropertyValue("--m3-accent-ink")).toBe("");
});

it("applies and clears a resource palette without changing the window palette", () => {
  const page = document.createElement("div");
  const windowStyle = document.documentElement.style;
  windowStyle.setProperty("--m3-primary-60", "#4193ed");
  windowStyle.setProperty("--m3-accent-fill", "#4193ed");
  const resourcePalette = {
    primary: { 60: "#d4793a" },
    accent: { fill: "#b35c23", ink: "#ffffff", hover: "#b35c23", active: "#9c4f1d" }
  } as MonetPalettes;

  applyMonetPalette(resourcePalette, page.style);
  expect(page.style.getPropertyValue("--m3-primary-60")).toBe("#d4793a");
  expect(page.style.getPropertyValue("--m3-accent-fill")).toBe("#b35c23");
  expect(windowStyle.getPropertyValue("--m3-accent-fill")).toBe("#4193ed");
  expect(windowStyle.getPropertyValue("--m3-primary-60")).toBe("#4193ed");

  applyMonetPalette(null, page.style);
  expect(page.style.getPropertyValue("--m3-primary-60")).toBe("");
  expect(page.style.getPropertyValue("--m3-accent-fill")).toBe("");
  expect(windowStyle.getPropertyValue("--m3-primary-60")).toBe("#4193ed");
});
