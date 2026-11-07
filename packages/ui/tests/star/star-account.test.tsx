import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { NeteaseStarAlbum, NeteaseStarArtist } from "@mahiru/ui/common/netease/models";
import Star from "@mahiru/ui/common/components/page/star";
import type { NeteaseUser } from "@mahiru/ui/common/netease/models";
import type { MediaItem } from "@mahiru/ui/common/components/layout/media-grid/card";

const mocks = vi.hoisted(() => ({ albums: vi.fn(), artists: vi.fn() }));

vi.mock("@/common/netease/services", () => ({
  NeteaseServicesStar: {
    albums: mocks.albums,
    artists: mocks.artists,
    playlists: () => []
  }
}));
vi.mock("@/common/components/display/menu", () => ({
  default: { useMenu: () => ({ create: vi.fn() }) }
}));
vi.mock("@/common/components/page/star/collection-view", () => ({
  default: ({ items, status }: { status: string; items: MediaItem[] }) => (
    <div data-status={status}>
      {items.map((item) => (
        <span key={item.id}>{item.name}</span>
      ))}
    </div>
  )
}));

function user(userId: number) {
  return { userId, isLoggedIn: true, starPlaylists: [] } as unknown as NeteaseUser;
}

function page(kind: "album" | "artist", name: string, count: number) {
  const item =
    kind === "album"
      ? new NeteaseStarAlbum({
          id: 1,
          name,
          coverUrl: "",
          size: 10,
          subTime: 1,
          artists: []
        })
      : new NeteaseStarArtist({
          id: 1,
          name,
          coverUrl: "",
          alias: [],
          albumSize: 10,
          mvSize: 2,
          fansCount: 100,
          followed: true,
          subTime: 1
        });
  return { items: [item], count, hasMore: false };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  mocks.albums.mockReset();
  mocks.artists.mockReset();
});
afterEach(cleanup);

it.each([
  { kind: "album" as const, label: "专辑" },
  { kind: "artist" as const, label: "歌手" }
])(
  "replaces $label state and aborts account A's request when switching directly to B",
  async ({ kind, label }) => {
    const request = kind === "album" ? mocks.albums : mocks.artists;
    const firstRefresh = deferred<ReturnType<typeof page>>();
    const secondPage = deferred<ReturnType<typeof page>>();
    request
      .mockResolvedValueOnce(page(kind, "Account A item", 9))
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondPage.promise);
    const view = render(<Star user={user(1)} routerActive />);
    fireEvent.click(view.getByRole("button", { name: label }));
    await view.findByText("Account A item");
    await view.findByText("9 项");

    fireEvent.click(view.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    const firstSignal = request.mock.calls[1]![1] as AbortSignal;
    view.rerender(<Star user={user(2)} routerActive />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));

    expect(firstSignal.aborted).toBe(true);
    expect(view.queryByText("Account A item")).not.toBeInTheDocument();
    expect(view.queryByText("9 项")).not.toBeInTheDocument();
    await act(async () => firstRefresh.resolve(page(kind, "Late account A item", 99)));
    expect(view.queryByText("Late account A item")).not.toBeInTheDocument();

    await act(async () => secondPage.resolve(page(kind, "Account B item", 7)));
    expect(await view.findByText("Account B item")).toBeInTheDocument();
    expect(await view.findByText("7 项")).toBeInTheDocument();
    expect(view.queryByText("99 项")).not.toBeInTheDocument();
  }
);
