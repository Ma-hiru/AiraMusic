import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import SimilarPlaylists from "@mahiru/ui/common/components/page/playlist-v2/similar-playlists";
import type { PropsWithChildren } from "react";
import type NeteaseAPIPlaylist from "@mahiru/ui/common/netease/api/playlist";
import type { MediaItem } from "@mahiru/ui/common/components/layout/media-grid/card";

const { logError, relative } = vi.hoisted(() => ({
  relative: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@/common/netease/api", () => ({
  NeteaseAPIPlaylist: { relative }
}));
vi.mock("@/common/lib/log", () => ({ Log: { error: logError } }));
vi.mock("@/common/components/fallback/app-loading", () => ({
  default: ({ tips }: { tips: string }) => <div role="status">{tips}</div>
}));
vi.mock("@/common/components/fallback/app-error", () => ({
  default: ({ tips, reset }: { tips: string; reset: () => void }) => (
    <button onClick={reset}>{tips}</button>
  )
}));
vi.mock("@/common/components/fallback/app-empty", () => ({
  default: ({ tips }: { tips: string }) => <p>{tips}</p>
}));
vi.mock("@/common/components/layout/infinite/infinite-container", () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>
}));
vi.mock("@/common/components/layout/media-grid/card", () => ({
  default: ({ onClick, item }: { item: MediaItem; onClick: (id: number) => void }) => (
    <button onClick={() => onClick(item.id)}>{item.name}</button>
  )
}));

type RelatedPlaylistResponse = Awaited<ReturnType<typeof NeteaseAPIPlaylist.relative>>;

function response(id: number): RelatedPlaylistResponse {
  return {
    code: 200,
    data: {
      rcmdTitle: "推荐",
      jumpUrl: "orpheus://playlistCollection",
      recPlaylist: [
        {
          alg: "similar",
          playlist: {
            id,
            name: `歌单 ${id}`,
            coverImgUrl: "https://example.com/cover.jpg",
            playCount: 10,
            specialType: 0,
            action: `orpheus://playlist/${id}`
          }
        }
      ]
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  relative.mockReset();
  logError.mockClear();
});
afterEach(cleanup);

it("opens the selected recommendation by its playlist ID", async () => {
  relative.mockResolvedValue(response(2));
  const onClick = vi.fn();
  const { findByRole } = render(<SimilarPlaylists id={1} onClick={onClick} />);

  fireEvent.click(await findByRole("button", { name: "歌单 2" }));
  expect(onClick).toHaveBeenCalledWith(2);
  expect(relative).toHaveBeenCalledWith(1, expect.any(AbortSignal));
});

it("aborts replaced requests and ignores responses that arrive after the playlist changes", async () => {
  const first = deferred<RelatedPlaylistResponse>();
  const second = deferred<RelatedPlaylistResponse>();
  relative.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const onClick = vi.fn();
  const { unmount, rerender, findByRole, queryByRole } = render(
    <SimilarPlaylists id={1} onClick={onClick} />
  );
  expect(relative).toHaveBeenCalledTimes(1);
  const firstSignal = relative.mock.calls[0]![1] as AbortSignal;

  rerender(<SimilarPlaylists id={10} onClick={onClick} />);
  expect(firstSignal.aborted).toBe(true);
  await act(async () => second.resolve(response(11)));
  expect(await findByRole("button", { name: "歌单 11" })).toBeInTheDocument();

  await act(async () => first.resolve(response(2)));
  expect(queryByRole("button", { name: "歌单 2" })).not.toBeInTheDocument();
  expect(queryByRole("button", { name: "歌单 11" })).toBeInTheDocument();

  expect(relative).toHaveBeenCalledTimes(2);
  const secondSignal = relative.mock.calls[1]![1] as AbortSignal;
  unmount();
  expect(secondSignal.aborted).toBe(true);
});

it("clears old recommendations and refetches when refreshed", async () => {
  const refreshed = deferred<RelatedPlaylistResponse>();
  relative.mockResolvedValueOnce(response(2)).mockReturnValueOnce(refreshed.promise);
  const onClick = vi.fn();
  const { rerender, findByRole, queryByRole } = render(
    <SimilarPlaylists id={1} refreshToken={0} onClick={onClick} />
  );
  await findByRole("button", { name: "歌单 2" });

  rerender(<SimilarPlaylists id={1} refreshToken={1} onClick={onClick} />);
  expect(queryByRole("button", { name: "歌单 2" })).not.toBeInTheDocument();
  expect(queryByRole("status")).toHaveTextContent("正在加载相似歌单");
  await act(async () => refreshed.resolve(response(3)));
  expect(await findByRole("button", { name: "歌单 3" })).toBeInTheDocument();
});

it("offers retry for failed responses and can recover to an empty result", async () => {
  relative
    .mockResolvedValueOnce({ code: 500, message: "暂不可用", data: null })
    .mockResolvedValueOnce({ code: 200, data: null });
  const { findByRole, findByText } = render(<SimilarPlaylists id={1} onClick={vi.fn()} />);

  fireEvent.click(await findByRole("button", { name: "相似歌单加载失败，点击重试" }));
  expect(await findByText("暂无相似歌单")).toBeInTheDocument();
  await waitFor(() => expect(relative).toHaveBeenCalledTimes(2));
});
