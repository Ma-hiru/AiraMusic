import { act, render, cleanup, renderHook } from "@testing-library/react";
import { usePlaylistLayout } from "@mahiru/ui/common/hooks/use-playlist-layout";
import {
  defaultSettings,
  type NeteaseSettingsModel
} from "@mahiru/ui/common/netease/models/netease-settings";
import AlbumSwitch from "@mahiru/ui/common/components/page/album-switch";
import ArtistSwitch from "@mahiru/ui/common/components/page/artist-switch";
import PlaylistSwitch from "@mahiru/ui/common/components/page/playlist-switch";
import type { Ref, ComponentProps } from "react";
import type { ArtistRef } from "@mahiru/ui/common/components/page/artist-switch";

type ArtistMockProps = {
  id: number;
  ref?: Ref<ArtistRef>;
  onAddList?: () => void;
  onReplace?: () => void;
  setIsTyping?: (typing: boolean) => void;
};

const shared = vi.hoisted(() => ({
  settings: null as unknown as NeteaseSettingsModel,
  listeners: new Set<() => void>(),
  updateSettings: vi.fn(),
  reload: vi.fn(),
  props: [] as ArtistMockProps[]
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

vi.mock("@/common/components/page/artist", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function LegacyArtistMock(props: ArtistMockProps) {
      shared.props.push(props);
      useImperativeHandle(props.ref, () => ({
        reload: shared.reload,
        artist: null,
        trackListRef: null
      }));
      return <div data-testid="legacy-artist">{props.id}</div>;
    }
  };
});

vi.mock("@/common/components/page/artist-v2", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function ArtistMock(props: ArtistMockProps) {
      shared.props.push(props);
      useImperativeHandle(props.ref, () => ({
        reload: shared.reload,
        artist: null,
        trackListRef: null
      }));
      return (
        <div data-testid="new-artist">
          {props.id}
          <input aria-label="搜索热门歌曲" onFocus={() => props.setIsTyping?.(true)} />
        </div>
      );
    }
  };
});

vi.mock("@/common/components/page/album", () => ({
  default: () => <div data-testid="legacy-album" />
}));
vi.mock("@/common/components/page/album-v2", () => ({
  default: () => <div data-testid="new-album" />
}));
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

function pages() {
  const artistProps = { id: 42 } as ComponentProps<typeof ArtistSwitch>;
  const albumProps = { id: 12 } as ComponentProps<typeof AlbumSwitch>;
  const playlistProps = { id: "24" } as ComponentProps<typeof PlaylistSwitch>;
  return (
    <>
      <ArtistSwitch {...artistProps} />
      <AlbumSwitch {...albumProps} />
      <PlaylistSwitch {...playlistProps} />
    </>
  );
}

it.each([
  [undefined, "new"],
  [false, "new"],
  [true, "legacy"]
])(
  "uses the existing optional preference for all three page kinds (legacy=%s)",
  (legacy, prefix) => {
    shared.settings.preference.useLegacyPlaylistLayout = legacy;
    const view = render(pages());
    expect(view.getByTestId(`${prefix}-artist`)).toHaveTextContent("42");
    expect(view.getByTestId(`${prefix}-album`)).toBeInTheDocument();
    expect(view.getByTestId(`${prefix}-playlist`)).toBeInTheDocument();
  }
);

it("synchronizes all page kinds and window consumers using only the existing setting", () => {
  const view = render(
    <>
      {pages()}
      {pages()}
    </>
  );
  const controller = renderHook(usePlaylistLayout);
  const preference = { ...shared.settings.preference };

  act(() => controller.result.current.toggleLayout());
  for (const name of ["artist", "album", "playlist"]) {
    expect(view.getAllByTestId(`legacy-${name}`)).toHaveLength(2);
  }
  expect(shared.settings.preference).toEqual({ ...preference, useLegacyPlaylistLayout: true });

  act(() => controller.result.current.toggleLayout());
  for (const name of ["artist", "album", "playlist"]) {
    expect(view.getAllByTestId(`new-${name}`)).toHaveLength(2);
  }
});

it("preserves the artist ref and optional playback, queue and typing callbacks", () => {
  const ref = { current: null as null | ArtistRef };
  const onReplace = vi.fn();
  const onAddList = vi.fn();
  const setIsTyping = vi.fn();
  const props = { id: 42, ref, onReplace, onAddList, setIsTyping } as unknown as ComponentProps<
    typeof ArtistSwitch
  >;
  render(<ArtistSwitch {...props} />);

  expect(shared.props.at(-1)).toMatchObject({ id: 42, onReplace, onAddList, setIsTyping });
  expect(ref.current?.reload).toBe(shared.reload);
  ref.current?.reload();
  expect(shared.reload).toHaveBeenCalledOnce();
});

it("clears input mode when another window replaces focused artist search", () => {
  const setIsTyping = vi.fn();
  const props = { id: 42, setIsTyping } as unknown as ComponentProps<typeof ArtistSwitch>;
  const view = render(<ArtistSwitch {...props} />);
  const search = view.getByRole("textbox", { name: "搜索热门歌曲" });
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

it("clears input mode when the artist page unmounts", () => {
  const setIsTyping = vi.fn();
  const props = { id: 42, setIsTyping } as unknown as ComponentProps<typeof ArtistSwitch>;
  const view = render(<ArtistSwitch {...props} />);
  act(() => view.getByRole("textbox", { name: "搜索热门歌曲" }).focus());
  view.unmount();
  expect(setIsTyping).toHaveBeenLastCalledWith(false);
});
