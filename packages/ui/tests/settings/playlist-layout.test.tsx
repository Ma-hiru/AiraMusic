import { act, render, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { usePlaylistLayout } from "@mahiru/ui/common/hooks/use-playlist-layout";
import {
  defaultSettings,
  NeteaseSettings,
  type NeteaseSettingsModel
} from "@mahiru/ui/common/netease/models/netease-settings";
import PlaylistSwitch from "@mahiru/ui/common/components/page/playlist-switch";
import Preference from "@mahiru/ui/common/components/page/settings/content/preference";
import type { ComponentProps } from "react";

const shared = vi.hoisted(() => ({
  settings: null as unknown as NeteaseSettingsModel,
  listeners: new Set<() => void>(),
  updateSettings: vi.fn(),
  searchBlur: vi.fn()
}));

vi.mock("@/common/store/settings", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSettings: () =>
      useSyncExternalStore(
        (listener) => {
          shared.listeners.add(listener);
          return () => shared.listeners.delete(listener);
        },
        () => shared.settings
      ),
    settingsStoreSnapshot: () => ({
      _settings: shared.settings,
      updateSettings: shared.updateSettings
    })
  };
});

vi.mock("@/common/components/page/playlist", () => ({
  default: ({ id, setIsTyping }: { id: string; setIsTyping?: (typing: boolean) => void }) => (
    <div data-testid="legacy-playlist">
      {id}
      <input
        aria-label="歌单搜索"
        onFocus={() => setIsTyping?.(true)}
        onBlur={() => {
          shared.searchBlur();
          setIsTyping?.(false);
        }}
      />
    </div>
  )
}));

vi.mock("@/common/components/page/playlist-v2", () => ({
  default: ({ id, setIsTyping }: { id: string; setIsTyping?: (typing: boolean) => void }) => (
    <div data-testid="new-playlist">
      {id}
      <input
        aria-label="歌单搜索"
        onFocus={() => setIsTyping?.(true)}
        onBlur={() => {
          shared.searchBlur();
          setIsTyping?.(false);
        }}
      />
    </div>
  )
}));

beforeEach(() => {
  shared.settings = structuredClone(defaultSettings);
  shared.searchBlur.mockReset();
  shared.updateSettings.mockReset().mockImplementation((settings: NeteaseSettingsModel) => {
    shared.settings = settings;
    shared.listeners.forEach((listener) => listener());
  });
});

afterEach(cleanup);

it("leaves the optional preference absent when loading older settings", () => {
  const settings = NeteaseSettings.fromObject(shared.settings);
  expect(settings.preference.useLegacyPlaylistLayout).toBeUndefined();
});

it.each([
  [undefined, "new-playlist"],
  [false, "new-playlist"],
  [true, "legacy-playlist"]
])("selects the expected component for legacy=%s and preserves the public props", (legacy, id) => {
  shared.settings.preference.useLegacyPlaylistLayout = legacy;
  const props = { id: "42" } as ComponentProps<typeof PlaylistSwitch>;
  const view = render(<PlaylistSwitch {...props} />);

  expect(view.getByTestId(id)).toHaveTextContent("42");
});

it("updates every consumer and preserves the latest unrelated preferences when toggled", () => {
  const first = renderHook(usePlaylistLayout);
  const second = renderHook(usePlaylistLayout);
  const oldToggle = first.result.current.toggleLayout;

  act(() => {
    shared.updateSettings({
      ...shared.settings,
      preference: { ...shared.settings.preference, defaultUseDisplayWindow: true }
    });
    oldToggle();
  });

  expect(first.result.current.legacy).toBe(true);
  expect(second.result.current.legacy).toBe(true);
  expect(shared.settings.preference.defaultUseDisplayWindow).toBe(true);
  expect(shared.settings.performance).toEqual(defaultSettings.performance);

  act(() => second.result.current.toggleLayout());
  expect(first.result.current.legacy).toBe(false);
  expect(second.result.current.legacy).toBe(false);
});

it.each([false, true])(
  "clears typing when another window replaces the focused layout or the page unmounts (legacy=%s)",
  (legacy) => {
    shared.settings.preference.useLegacyPlaylistLayout = legacy;
    const setIsTyping = vi.fn();
    const props = { id: "42", setIsTyping } as unknown as ComponentProps<typeof PlaylistSwitch>;
    const view = render(<PlaylistSwitch {...props} />);
    const search = view.getByRole("textbox", { name: "歌单搜索" });

    act(() => search.focus());
    expect(search).toHaveFocus();
    expect(setIsTyping).toHaveBeenLastCalledWith(true);

    act(() => {
      shared.updateSettings({
        ...shared.settings,
        preference: { ...shared.settings.preference, useLegacyPlaylistLayout: !legacy }
      });
    });

    expect(search).not.toBeInTheDocument();
    expect(shared.searchBlur).not.toHaveBeenCalled();
    expect(setIsTyping).toHaveBeenLastCalledWith(false);

    const nextSearch = view.getByRole("textbox", { name: "歌单搜索" });
    act(() => nextSearch.focus());
    expect(nextSearch).toHaveFocus();
    expect(setIsTyping).toHaveBeenLastCalledWith(true);

    view.unmount();
    expect(shared.searchBlur).not.toHaveBeenCalled();
    expect(setIsTyping).toHaveBeenLastCalledWith(false);
  }
);

it("offers an off-by-default legacy layout setting without changing other preferences", () => {
  const patchSettings = vi.fn();
  const data = shared.settings.preference;
  const view = render(<Preference data={data} patchSettings={patchSettings} />);
  const row = view.getByText("使用简约版歌单、专辑和歌手页面").closest("section")!;
  const toggle = row.querySelector("button")!;

  expect(toggle).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(toggle);
  expect(patchSettings).toHaveBeenCalledExactlyOnceWith({
    preference: { ...data, useLegacyPlaylistLayout: true }
  });
});
