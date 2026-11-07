import { type Ref, StrictMode, useImperativeHandle } from "react";
import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { SearchTrack } from "@mahiru/wasm";
import { NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";
import {
  createPlayListDrawer,
  createPlayerPlaylistDrawer
} from "@mahiru/ui/common/components/display/drawer/player-playlist-drawer";
import AppModal from "@mahiru/ui/common/components/display/modal/use";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import PlayListQueue, {
  type PlayListQueueProps
} from "@mahiru/ui/common/components/page/play-list/queue";
import type RendererPlayer from "@mahiru/ui/common/player/core";
import type { TrackListRef, TrackListProps } from "@mahiru/ui/common/components/display/track_list";

const mocks = vi.hoisted(() => ({
  menu: vi.fn(),
  renderList: vi.fn(),
  scroll: vi.fn(async () => {}),
  jumpAlbum: vi.fn(),
  jumpArtist: vi.fn(),
  onJumpPage: vi.fn(),
  openComment: vi.fn(),
  addLast: vi.fn(),
  addNext: vi.fn(),
  addToPlaylist: vi.fn()
}));

vi.mock("@/common/components/display/modal", async () => ({
  default: (await import("@mahiru/ui/common/components/display/modal/use")).default,
  createTrackInfoModal: ({ track }: { track: NeteaseTrackRecord }) => ({
    title: "歌曲信息",
    content: <p>{track.detail.name}</p>
  })
}));
vi.mock("@/common/components/display/menu", () => ({
  default: {
    useMenu: () => ({ create: mocks.menu, createTrackContextMenu: vi.fn() })
  }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: () => <span aria-label="当前歌曲封面" />
}));
vi.mock("@/common/hooks/use-track-add-to-playlist", () => ({
  openTrackAddToPlaylist: mocks.addToPlaylist
}));
vi.mock("@/common/hooks/use-user-track-manager", () => ({
  useUserTrackManager: () => ({ heartManager: undefined, playableManager: undefined })
}));
vi.mock("@/common/components/display/track_list", () => ({
  default: function TrackListMock({
    ref,
    onClick,
    onContext,
    onClickAlbum,
    onClickArtist,
    tracks,
    emptyTips
  }: { ref?: Ref<TrackListRef> } & TrackListProps<NeteaseTrackRecord[]>) {
    mocks.renderList();
    useImperativeHandle(ref, () => ({
      containerRef: { current: null },
      scrollToItem: mocks.scroll
    }));
    return (
      <div aria-label="队列歌曲">
        {tracks.length ? (
          tracks.map((track, index) => (
            <div key={track.id}>
              <button onClick={() => onClick?.(track, index)}>{track.detail.name}</button>
              <button onClick={() => onClickAlbum?.(track.detail.al.id)}>专辑 {track.id}</button>
              <button onClick={() => onClickArtist?.(track.detail.ar[0]!.id)}>
                歌手 {track.id}
              </button>
              <button onClick={(event) => onContext?.(event as never, track, index)}>
                菜单 {track.id}
              </button>
            </div>
          ))
        ) : (
          <p>{emptyTips}</p>
        )}
      </div>
    );
  }
}));

function makeTrack(id: number, name: string, artist: string, album: string) {
  return new NeteaseTrackRecord({
    sourceID: 1,
    sourceName: "playlist",
    detail: new NeteaseTrack({
      id,
      name,
      ar: [{ id: id + 10, name: artist, alias: [], tns: [] }],
      al: { id: id + 20, name: album, picUrl: "https://example.com/cover.jpg", pic: 0, tns: [] },
      alia: [],
      tns: [],
      dt: 180_000,
      fee: 0,
      mark: 0,
      mv: 0,
      no: 1,
      originCoverType: 0,
      pop: 0,
      publishTime: 0,
      noCopyrightRcmd: null,
      h: null,
      hr: null,
      l: null,
      m: null,
      sq: null,
      privilege: null
    })
  });
}

const first = makeTrack(7, "First song", "First artist", "First album");
const current = makeTrack(8, "Current song", "Current artist", "Current album");
const last = makeTrack(9, "Last song", "Last artist", "Last album");
let tracks: NeteaseTrackRecord[];
let listeners: Set<() => void>;
const jump = vi.fn();
const audioEvents = new EventTarget();
const audio = {
  progress: { currentTime: 65, duration: 245 },
  addEventListener: audioEvents.addEventListener.bind(audioEvents),
  removeEventListener: audioEvents.removeEventListener.bind(audioEvents)
};
const player = {
  audio,
  current: { track: current },
  playing: true,
  statusText: "playing",
  playlist: {
    list: () => [...tracks],
    pos: () => tracks.findIndex((track) => track.id === current.id),
    jump
  },
  addListener: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
} as unknown as RendererPlayer;

function QueueButtons() {
  const { create } = AppDrawer.useDrawer();
  const open = () =>
    create(createPlayerPlaylistDrawer, {
      player,
      jumpAlbumPage: mocks.jumpAlbum,
      jumpArtistPage: mocks.jumpArtist,
      openTrackComment: mocks.openComment,
      addTrackToPlaylistLast: mocks.addLast,
      addTrackToPlaylistNext: mocks.addNext,
      onJumpPage: mocks.onJumpPage
    });

  return (
    <>
      <button onClick={open}>播放条播放列表</button>
      <button onClick={open}>播放器播放列表</button>
      <AppDrawer.Provider />
      <AppModal.Provider />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tracks = [first, current, last];
  listeners = new Set();
  player.current.track = current;
  audio.progress.currentTime = 65;
  audio.progress.duration = 245;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openQueue(strict = false) {
  const view = render(
    strict ? (
      <StrictMode>
        <QueueButtons />
      </StrictMode>
    ) : (
      <QueueButtons />
    )
  );
  fireEvent.click(view.getByRole("button", { name: "播放条播放列表" }));
  await view.findByRole("dialog", { name: "播放列表" });
  return view;
}

it.each(["播放条播放列表", "播放器播放列表"])(
  "keeps %s open after its queue content mounts in StrictMode",
  async (label) => {
    const view = render(
      <StrictMode>
        <QueueButtons />
      </StrictMode>
    );
    fireEvent.click(view.getByRole("button", { name: label }));

    expect(await view.findByRole("dialog", { name: "播放列表" })).toBeInTheDocument();
    expect(AppDrawer.__visibleGetter()).toBe(true);
    expect(view.getByText("正在播放")).toBeInTheDocument();
    expect(within(view.getByLabelText("队列歌曲")).getAllByRole("button")).toHaveLength(12);
    await waitFor(() => expect(mocks.scroll).toHaveBeenCalledWith(1));
  }
);

it.each(["Last song", "Last artist", "Last album"])(
  "uses the real WASM search for %s without modifying the queue",
  async (query) => {
    const view = await openQueue(true);
    fireEvent.change(view.getByRole("textbox", { name: "搜索队列" }), { target: { value: query } });
    const list = within(view.getByLabelText("队列歌曲"));

    await waitFor(() =>
      expect(list.getByRole("button", { name: "Last song" })).toBeInTheDocument()
    );
    expect(list.queryByRole("button", { name: "First song" })).not.toBeInTheDocument();
    expect(tracks).toEqual([first, current, last]);
    fireEvent.click(list.getByRole("button", { name: "Last song" }));
    expect(jump).toHaveBeenCalledWith(last);
  }
);

it("updates the search index when queue content changes and locates the current unfiltered row", async () => {
  const view = await openQueue();
  const search = view.getByRole("textbox", { name: "搜索队列" });
  fireEvent.change(search, { target: { value: "replacement" } });
  await view.findByText("没有匹配的歌曲");

  const replacement = makeTrack(10, "Replacement song", "New artist", "New album");
  act(() => {
    tracks = [replacement, first, current, last];
    listeners.forEach((listener) => listener());
  });
  expect(
    await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "Replacement song" })
  ).toBeInTheDocument();
  mocks.scroll.mockClear();
  fireEvent.click(view.getByRole("button", { name: "定位当前" }));

  expect(search).toHaveValue("");
  await waitFor(() => expect(mocks.scroll).toHaveBeenCalledWith(2));
  expect(within(view.getByLabelText("队列歌曲")).getAllByRole("button")).toHaveLength(16);
});

it.each(["album", "artist"])(
  "closes the drawer and keeps navigation callbacks for %s",
  async (target) => {
    const view = await openQueue();
    fireEvent.click(view.getByRole("button", { name: target === "album" ? "专辑 7" : "歌手 7" }));

    expect(target === "album" ? mocks.jumpAlbum : mocks.jumpArtist).toHaveBeenCalledWith(
      target === "album" ? 27 : 17
    );
    expect(mocks.onJumpPage).toHaveBeenCalledOnce();
    await waitFor(() => expect(AppDrawer.__visibleGetter()).toBe(false));
  }
);

it("keeps song details and the drawer open independently in StrictMode", async () => {
  const view = await openQueue(true);
  fireEvent.click(view.getByRole("button", { name: "菜单 7" }));
  const menu = mocks.menu.mock.calls[0]![1] as {
    onClick: (type: string, track: NeteaseTrackRecord) => void;
  };
  act(() => menu.onClick("info", first));

  expect(await view.findByRole("dialog", { name: "歌曲信息" })).toHaveTextContent("First song");
  expect(view.getByRole("dialog", { name: "播放列表" })).toBeInTheDocument();
  expect(AppDrawer.__visibleGetter()).toBe(true);
  expect(AppModal.__visibleGetter()).toBe(true);
});

it("opens the existing song information modal from the current song card", async () => {
  const view = await openQueue(true);
  act(() => {
    player.current.track = last;
    listeners.forEach((listener) => listener());
  });
  fireEvent.click(view.getByRole("button", { name: "歌曲信息" }));

  expect(await view.findByRole("dialog", { name: "歌曲信息" })).toHaveTextContent("Last song");
  expect(view.getByRole("dialog", { name: "播放列表" })).toBeInTheDocument();
  expect(AppDrawer.__visibleGetter()).toBe(true);
});

it("updates elapsed and total time without rerendering the queue and releases audio listeners", async () => {
  const addListener = vi.spyOn(audio, "addEventListener");
  const removeListener = vi.spyOn(audio, "removeEventListener");
  const view = await openQueue(true);
  const timer = view.getByRole("timer", { name: "播放进度" });
  expect(timer).toHaveTextContent("1:05/4:05");
  const renders = mocks.renderList.mock.calls.length;

  act(() => {
    audio.progress.currentTime = 121;
    audioEvents.dispatchEvent(new Event("timeupdate"));
  });
  expect(timer).toHaveTextContent("2:01/4:05");
  act(() => {
    audio.progress.duration = 185;
    audioEvents.dispatchEvent(new Event("durationchange"));
  });
  expect(timer).toHaveTextContent("2:01/3:05");
  expect(mocks.renderList).toHaveBeenCalledTimes(renders);

  view.unmount();
  for (const [type, listener] of addListener.mock.calls) {
    expect(removeListener).toHaveBeenCalledWith(type, listener);
  }
});

it("omits song actions and progress when the queue has no current track", async () => {
  player.current.track = null;
  tracks = [];
  const view = await openQueue();

  expect(view.queryByRole("button", { name: "歌曲信息" })).not.toBeInTheDocument();
  expect(view.queryByRole("timer")).not.toBeInTheDocument();
  expect(view.getByText("暂无播放歌曲")).toBeInTheDocument();
});

it("preserves queue menu play, enqueue, comment and favorite actions", async () => {
  const view = await openQueue();
  fireEvent.click(view.getByRole("button", { name: "菜单 7" }));
  const menu = mocks.menu.mock.calls[0]![1] as {
    onClick: (type: string, track: NeteaseTrackRecord) => void;
  };
  act(() => {
    for (const action of ["play", "nextPlay", "addPlayList", "comment", "favPlaylist"]) {
      menu.onClick(action, first);
    }
  });

  for (const callback of [
    jump,
    mocks.addNext,
    mocks.addLast,
    mocks.openComment,
    mocks.addToPlaylist
  ]) {
    expect(callback).toHaveBeenCalledWith(first);
  }
});

it("builds the search index on demand and reuses it across queries and playback updates", async () => {
  const serialize = vi.spyOn(NeteaseTrack, "toSearchStructString");
  const update = vi.spyOn(SearchTrack.prototype, "update");
  const free = vi.spyOn(SearchTrack.prototype, "free");
  const view = await openQueue(true);
  expect(serialize).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(free).not.toHaveBeenCalled();

  act(() => listeners.forEach((listener) => listener()));
  const input = view.getByRole("textbox", { name: "搜索队列" });
  fireEvent.change(input, { target: { value: "Last artist" } });
  await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "Last song" });
  expect(serialize).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledOnce();

  act(() => listeners.forEach((listener) => listener()));
  fireEvent.change(input, { target: { value: "First artist" } });
  await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "First song" });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.change(input, { target: { value: "Last artist" } });
  expect(serialize).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledOnce();

  act(() => {
    tracks = [last, current, first];
    listeners.forEach((listener) => listener());
  });
  expect(serialize).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(free).toHaveBeenCalledOnce();
});

function queueProps(overrides: Partial<PlayListQueueProps> = {}): PlayListQueueProps {
  return {
    tracks: [first, current, last],
    activeTrack: current,
    activeIndex: 1,
    status: "paused",
    progress: <span>远程播放进度</span>,
    onPlay: vi.fn(),
    onClickAlbum: mocks.jumpAlbum,
    onClickArtist: mocks.jumpArtist,
    openComment: mocks.openComment,
    addToPlaylistLast: mocks.addLast,
    addToPlaylistNext: mocks.addNext,
    ...overrides
  };
}

it("searches only the searchable fields instead of serializing unused track metadata", async () => {
  const record = makeTrack(20, "Projected song", "Projected artist", "Projected album");
  Object.defineProperty(record.detail, "privilege", {
    get: () => {
      throw new Error("Search must not serialize playback privileges");
    }
  });
  const view = render(<PlayListQueue {...queueProps({ tracks: [record] })} />);
  fireEvent.change(view.getByRole("textbox", { name: "搜索队列" }), {
    target: { value: "Projected artist" }
  });
  expect(
    await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "Projected song" })
  ).toBeInTheDocument();
});

it("refreshes search results when metadata changes for an existing song id", async () => {
  const props = queueProps();
  const view = render(<PlayListQueue {...props} />);
  const input = view.getByRole("textbox", { name: "搜索队列" });
  fireEvent.change(input, { target: { value: "First song" } });
  const list = within(view.getByLabelText("队列歌曲"));
  expect(await list.findByRole("button", { name: "First song" })).toBeInTheDocument();

  const renamed = makeTrack(first.id, "Renamed song", "First artist", "First album");
  view.rerender(<PlayListQueue {...props} tracks={[renamed, current, last]} />);
  await list.findByText("没有匹配的歌曲");
  fireEvent.change(input, { target: { value: "Renamed song" } });
  expect(await list.findByRole("button", { name: "Renamed song" })).toBeInTheDocument();
});

it("renders snapshot props without a player and keeps the original queue position when filtered", async () => {
  const onPlay = vi.fn();
  const props = queueProps({ onPlay });
  const view = render(<PlayListQueue {...props} />);
  expect(view.getByText("已暂停")).toBeInTheDocument();
  expect(view.getByText("远程播放进度")).toBeInTheDocument();
  const search = view.getByRole("textbox", { name: "搜索队列" });
  fireEvent.change(search, { target: { value: "Last song" } });
  fireEvent.click(
    await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "Last song" })
  );
  expect(onPlay).toHaveBeenCalledWith(last, 2);

  const replacement = makeTrack(11, "Last song replacement", "Other artist", "Other album");
  view.rerender(
    <PlayListQueue
      {...props}
      activeIndex={2}
      status="loading"
      tracks={[replacement, first, current, last]}
    />
  );
  expect(search).toHaveValue("Last song");
  expect(view.getByText("加载中")).toBeInTheDocument();
  const list = within(view.getByLabelText("队列歌曲"));
  expect(await list.findByRole("button", { name: "Last song replacement" })).toBeInTheDocument();
  fireEvent.click(list.getByRole("button", { name: "Last song" }));
  expect(onPlay).toHaveBeenLastCalledWith(last, 3);
});

it("pauses WASM work while its queue page is inactive and rebuilds on activation", async () => {
  const update = vi.spyOn(SearchTrack.prototype, "update");
  const free = vi.spyOn(SearchTrack.prototype, "free");
  const props = queueProps({ active: false });
  const view = render(<PlayListQueue {...props} />);
  expect(update).not.toHaveBeenCalled();
  fireEvent.change(view.getByRole("textbox", { name: "搜索队列" }), {
    target: { value: "Last artist" }
  });
  expect(update).not.toHaveBeenCalled();

  view.rerender(<PlayListQueue {...props} active />);
  expect(
    await within(view.getByLabelText("队列歌曲")).findByRole("button", { name: "Last song" })
  ).toBeInTheDocument();
  expect(update).toHaveBeenCalledOnce();
  view.rerender(<PlayListQueue {...props} />);
  expect(free).toHaveBeenCalledOnce();
  view.unmount();
  expect(free).toHaveBeenCalledOnce();
});

it.each(["player", "snapshot"])("closes the %s drawer before expanding the page", (source) => {
  const close = vi.spyOn(AppDrawer, "close").mockImplementation(() => {});
  const order: string[] = [];
  close.mockImplementation(() => {
    order.push("close");
  });
  const onPageAction = () => {
    order.push("page");
  };
  const drawer =
    source === "player"
      ? createPlayerPlaylistDrawer({
          player,
          jumpAlbumPage: mocks.jumpAlbum,
          jumpArtistPage: mocks.jumpArtist,
          openTrackComment: mocks.openComment,
          addTrackToPlaylistLast: mocks.addLast,
          addTrackToPlaylistNext: mocks.addNext,
          onPageAction
        })
      : createPlayListDrawer({ content: <p>共享队列内容</p>, onPageAction });
  const view = render(<>{drawer.headerActions}</>);
  fireEvent.click(view.getByRole("button", { name: "展开播放列表" }));
  expect(order).toEqual(["close", "page"]);
  expect(drawer.resizable).toEqual({ minWidth: 360, maxWidth: 640 });
});
