import { act, render, cleanup, renderHook } from "@testing-library/react";
import { usePlaylistLayout } from "@mahiru/ui/common/hooks/use-playlist-layout";
import {
  defaultSettings,
  type NeteaseSettingsModel
} from "@mahiru/ui/common/netease/models/netease-settings";
import AlbumSwitch from "@mahiru/ui/common/components/page/album-switch";
import PlaylistSwitch from "@mahiru/ui/common/components/page/playlist-switch";
import type { Ref, ComponentProps } from "react";
import type { AlbumPageRef } from "@mahiru/ui/common/components/page/album-switch";

const shared = vi.hoisted(() => ({
  settings: null as unknown as NeteaseSettingsModel,
  listeners: new Set<() => void>(),
  updateSettings: vi.fn(),
  reload: vi.fn(),
  props: [] as { id: number; onReplace?: () => void; setIsTyping?: (typing: boolean) => void }[]
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

vi.mock("@/common/components/page/album", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function LegacyAlbumMock(props: {
      id: number;
      onReplace?: () => void;
      ref?: Ref<AlbumPageRef>;
      setIsTyping?: (typing: boolean) => void;
    }) {
      shared.props.push(props);
      useImperativeHandle(props.ref, () => ({
        reload: shared.reload,
        album: null,
        dynamic: null,
        trackListRef: null
      }));
      return <div data-testid="legacy-album">{props.id}</div>;
    }
  };
});

vi.mock("@/common/components/page/album-v2", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function AlbumMock(props: {
      id: number;
      onReplace?: () => void;
      ref?: Ref<AlbumPageRef>;
      setIsTyping?: (typing: boolean) => void;
    }) {
      shared.props.push(props);
      useImperativeHandle(props.ref, () => ({
        reload: shared.reload,
        album: null,
        dynamic: null,
        trackListRef: null
      }));
      return (
        <div data-testid="new-album">
          {props.id}
          <input aria-label="搜索此专辑" onFocus={() => props.setIsTyping?.(true)} />
        </div>
      );
    }
  };
});

vi.mock("@/common/components/page/playlist", () => ({
  default: () => <div data-testid="legacy-playlist" />
}));
vi.mock("@/common/components/page/playlist-v2", () => ({
  default: () => <div data-testid="new-playlist" />
}));

beforeEach(() => {
  shared.settings = structuredClone(defaultSettings);
  shared.props = [];
  shared.reload.mockReset();
  shared.updateSettings.mockReset().mockImplementation((settings: NeteaseSettingsModel) => {
    shared.settings = settings;
    shared.listeners.forEach((listener) => listener());
  });
});

afterEach(cleanup);

it.each([
  [undefined, "new"],
  [false, "new"],
  [true, "legacy"]
])("uses the same optional preference for albums and playlists (legacy=%s)", (legacy, prefix) => {
  shared.settings.preference.useLegacyPlaylistLayout = legacy;
  const albumProps = { id: 42 } as ComponentProps<typeof AlbumSwitch>;
  const playlistProps = { id: "24" } as ComponentProps<typeof PlaylistSwitch>;
  const view = render(
    <>
      <AlbumSwitch {...albumProps} />
      <PlaylistSwitch {...playlistProps} />
    </>
  );

  expect(view.getByTestId(`${prefix}-album`)).toHaveTextContent("42");
  expect(view.getByTestId(`${prefix}-playlist`)).toBeInTheDocument();
});

it("switches both page kinds and window consumers through the existing single setting", () => {
  const albumProps = { id: 42 } as ComponentProps<typeof AlbumSwitch>;
  const playlistProps = { id: "24" } as ComponentProps<typeof PlaylistSwitch>;
  const view = render(
    <>
      <AlbumSwitch {...albumProps} />
      <AlbumSwitch {...albumProps} />
      <PlaylistSwitch {...playlistProps} />
      <PlaylistSwitch {...playlistProps} />
    </>
  );
  const controller = renderHook(usePlaylistLayout);
  const preference = { ...shared.settings.preference };

  act(() => controller.result.current.toggleLayout());
  expect(view.getAllByTestId("legacy-album")).toHaveLength(2);
  expect(view.getAllByTestId("legacy-playlist")).toHaveLength(2);
  expect(shared.settings.preference).toEqual({ ...preference, useLegacyPlaylistLayout: true });

  act(() => controller.result.current.toggleLayout());
  expect(view.getAllByTestId("new-album")).toHaveLength(2);
  expect(view.getAllByTestId("new-playlist")).toHaveLength(2);
});

it("preserves the album imperative ref and optional playback and typing callbacks", () => {
  const ref = { current: null as null | AlbumPageRef };
  const onReplace = vi.fn();
  const setIsTyping = vi.fn();
  const props = { id: 42, ref, onReplace, setIsTyping } as unknown as ComponentProps<
    typeof AlbumSwitch
  >;
  render(<AlbumSwitch {...props} />);

  expect(shared.props.at(-1)).toMatchObject({ id: 42, onReplace, setIsTyping });
  expect(ref.current?.reload).toBe(shared.reload);
  ref.current?.reload();
  expect(shared.reload).toHaveBeenCalledOnce();
});

it("clears input mode when an external layout toggle removes focused album search", () => {
  const setIsTyping = vi.fn();
  const props = { id: 42, setIsTyping } as unknown as ComponentProps<typeof AlbumSwitch>;
  const view = render(<AlbumSwitch {...props} />);
  const search = view.getByRole("textbox", { name: "搜索此专辑" });
  act(() => search.focus());
  expect(setIsTyping).toHaveBeenLastCalledWith(true);

  act(() => {
    shared.updateSettings({
      ...shared.settings,
      preference: { ...shared.settings.preference, useLegacyPlaylistLayout: true }
    });
  });
  expect(search).not.toBeInTheDocument();
  expect(setIsTyping).toHaveBeenLastCalledWith(false);
});

it("clears input mode when the album page unmounts", () => {
  const setIsTyping = vi.fn();
  const props = { id: 42, setIsTyping } as unknown as ComponentProps<typeof AlbumSwitch>;
  const view = render(<AlbumSwitch {...props} />);
  act(() => view.getByRole("textbox", { name: "搜索此专辑" }).focus());
  view.unmount();
  expect(setIsTyping).toHaveBeenLastCalledWith(false);
});
