import { act, render, cleanup, fireEvent } from "@testing-library/react";
import ArtistAlbums from "@mahiru/ui/common/components/page/album-v2/artist-albums";
import type { PropsWithChildren } from "react";
import type NeteaseAPIArtist from "@mahiru/ui/common/netease/api/artist";
import type { MediaItem } from "@mahiru/ui/common/components/layout/media-grid/card";

const mocks = vi.hoisted(() => ({
  items: vi.fn<(item: MediaItem) => void>(),
  albums: vi.fn(),
  logError: vi.fn(),
  loadMore: undefined as undefined | (() => void | Promise<void>)
}));

vi.mock("@/common/netease/api", () => ({ NeteaseAPIArtist: { albums: mocks.albums } }));
vi.mock("@/common/lib/log", () => ({ Log: { error: mocks.logError } }));
vi.mock("@/common/components/fallback/app-loading", () => ({
  default: ({ tips }: { tips: string }) => <p role="status">{tips}</p>
}));
vi.mock("@/common/components/fallback/app-empty", () => ({
  default: ({ tips }: { tips: string }) => <p>{tips}</p>
}));
vi.mock("@/common/components/fallback/app-error", () => ({
  default: ({ tips, reset }: { tips: string; reset: () => void }) => (
    <button onClick={reset}>{tips}</button>
  )
}));
vi.mock("@/common/components/layout/infinite/infinite-container", () => ({
  default: ({
    onLoadMore,
    hasMore,
    children,
    disabled,
    isLoading
  }: PropsWithChildren<{
    hasMore: boolean;
    disabled?: boolean;
    isLoading: boolean;
    onLoadMore: () => void | Promise<void>;
  }>) => {
    mocks.loadMore = onLoadMore;
    return (
      <div>
        {children}
        <button disabled={!hasMore || isLoading || disabled} onClick={onLoadMore}>
          加载更多
        </button>
      </div>
    );
  }
}));
vi.mock("@/common/components/layout/media-grid/card", () => ({
  default: ({ onClick, item }: { item: MediaItem; onClick: (id: number) => void }) => {
    mocks.items(item);
    return <button onClick={() => onClick(item.id)}>{item.name}</button>;
  }
}));

type ArtistAlbumResponse = Awaited<ReturnType<typeof NeteaseAPIArtist.albums>>;
type ArtistAlbum = ArtistAlbumResponse["hotAlbums"][number];
function album(id: number): ArtistAlbum {
  return {
    id,
    name: `专辑 ${id}`,
    picUrl: `https://example.com/${id}.jpg`,
    size: 12,
    publishTime: 1577836800000
  } as ArtistAlbum;
}

function response(ids: number[], more = false): ArtistAlbumResponse {
  return {
    code: 200,
    hotAlbums: ids.map(album),
    more,
    artist: { albumSize: 4 }
  } as ArtistAlbumResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  mocks.albums.mockReset();
  mocks.logError.mockClear();
  mocks.items.mockClear();
  mocks.loadMore = undefined;
});
afterEach(cleanup);

it("maps real album metadata, excluding the current album and repeated IDs across pages", async () => {
  mocks.albums
    .mockResolvedValueOnce(response([1, 2, 2], true))
    .mockResolvedValueOnce(response([1, 2, 3]));
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={vi.fn()} />);
  await view.findByRole("button", { name: "专辑 2" });
  expect(view.getByText("已加载 1 / 3 张其他专辑")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  await view.findByRole("button", { name: "专辑 3" });
  expect(view.getByText("已加载 2 / 3 张其他专辑")).toBeInTheDocument();

  expect(view.queryByRole("button", { name: "专辑 1" })).not.toBeInTheDocument();
  expect(view.getAllByRole("button", { name: "专辑 2" })).toHaveLength(1);
  const item = mocks.items.mock.calls.map(([item]) => item).find((item) => item.id === 2);
  expect(item).toMatchObject({
    name: "专辑 2",
    coverUrl: "https://example.com/2.jpg",
    badge: "12 首",
    meta: expect.stringMatching(/^2020-/)
  });
});

it("loads actual API pages once at a time and forwards the chosen album ID", async () => {
  const second = deferred<ArtistAlbumResponse>();
  mocks.albums.mockResolvedValueOnce(response([1, 2], true)).mockReturnValueOnce(second.promise);
  const onClick = vi.fn();
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={onClick} />);

  fireEvent.click(await view.findByRole("button", { name: "专辑 2" }));
  expect(onClick).toHaveBeenCalledExactlyOnceWith(2);
  expect(mocks.albums).toHaveBeenNthCalledWith(
    1,
    { id: 10, pageNo: 1, pageSize: 20 },
    expect.any(AbortSignal)
  );
  await act(async () => {
    void mocks.loadMore?.();
    void mocks.loadMore?.();
  });
  expect(mocks.albums).toHaveBeenCalledTimes(2);
  expect(mocks.albums).toHaveBeenNthCalledWith(
    2,
    { id: 10, pageNo: 2, pageSize: 20 },
    expect.any(AbortSignal)
  );

  await act(async () => second.resolve(response([2, 3])));
  expect(view.getAllByRole("button", { name: "专辑 2" })).toHaveLength(1);
  expect(view.getByRole("button", { name: "专辑 3" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "加载更多" })).toBeDisabled();
  await act(async () => mocks.loadMore?.());
  expect(mocks.albums).toHaveBeenCalledTimes(2);
});

it("aborts changed artist requests and ignores late responses after replacement or unmount", async () => {
  const first = deferred<ArtistAlbumResponse>();
  const second = deferred<ArtistAlbumResponse>();
  mocks.albums.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const onClick = vi.fn();
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={onClick} />);
  const signal = mocks.albums.mock.calls[0]![1] as AbortSignal;

  view.rerender(<ArtistAlbums artistID={20} currentAlbumID={5} onClick={onClick} />);
  expect(signal.aborted).toBe(true);
  await act(async () => second.resolve(response([6])));
  expect(await view.findByRole("button", { name: "专辑 6" })).toBeInTheDocument();
  await act(async () => first.resolve(response([2])));
  expect(view.queryByRole("button", { name: "专辑 2" })).not.toBeInTheDocument();

  const currentSignal = mocks.albums.mock.calls[1]![1] as AbortSignal;
  view.unmount();
  expect(currentSignal.aborted).toBe(true);
});

it("resets pagination and exclusion when opening another album from the same artist", async () => {
  mocks.albums.mockResolvedValue(response([1, 2, 3]));
  const onClick = vi.fn();
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={onClick} />);
  await view.findByRole("button", { name: "专辑 2" });
  const signal = mocks.albums.mock.calls[0]![1] as AbortSignal;

  view.rerender(<ArtistAlbums artistID={10} currentAlbumID={2} onClick={onClick} />);
  expect(signal.aborted).toBe(true);
  expect(await view.findByRole("button", { name: "专辑 1" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "专辑 2" })).not.toBeInTheDocument();
  expect(mocks.albums).toHaveBeenLastCalledWith(
    { id: 10, pageNo: 1, pageSize: 20 },
    expect.any(AbortSignal)
  );
});

it("retains loaded albums when the next page fails and retries the same page", async () => {
  mocks.albums
    .mockResolvedValueOnce(response([2], true))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response([3]));
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={vi.fn()} />);
  await view.findByRole("button", { name: "专辑 2" });
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));

  const retry = await view.findByRole("button", { name: "加载失败，点击重试" });
  expect(view.getByRole("button", { name: "专辑 2" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "加载更多" })).toBeDisabled();
  fireEvent.click(retry);
  expect(await view.findByRole("button", { name: "专辑 3" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "专辑 2" })).toBeInTheDocument();
  expect(mocks.albums.mock.calls.map(([params]) => params.pageNo)).toEqual([1, 2, 2]);
  expect(mocks.logError).toHaveBeenCalledOnce();
});

it("offers initial retry and recovers to an actual empty result", async () => {
  mocks.albums
    .mockResolvedValueOnce({ code: 500, message: "暂不可用" })
    .mockResolvedValueOnce(response([1]));
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={vi.fn()} />);
  fireEvent.click(await view.findByRole("button", { name: "歌手专辑加载失败，点击重试" }));
  expect(await view.findByText("暂无其他专辑")).toBeInTheDocument();
  expect(mocks.albums.mock.calls.map(([params]) => params.pageNo)).toEqual([1, 1]);
});

it("continues past a page containing only the current album when the API has more", async () => {
  mocks.albums.mockResolvedValueOnce(response([1], true)).mockResolvedValueOnce(response([2]));
  const view = render(<ArtistAlbums artistID={10} currentAlbumID={1} onClick={vi.fn()} />);
  const loadMore = await view.findByRole("button", { name: "加载更多" });
  expect(view.queryByText("暂无其他专辑")).not.toBeInTheDocument();
  fireEvent.click(loadMore);
  expect(await view.findByRole("button", { name: "专辑 2" })).toBeInTheDocument();
});

it("does not request albums when no artist ID is available", () => {
  const view = render(<ArtistAlbums artistID={0} currentAlbumID={1} onClick={vi.fn()} />);
  expect(view.getByText("暂无其他专辑")).toBeInTheDocument();
  expect(mocks.albums).not.toHaveBeenCalled();
});
