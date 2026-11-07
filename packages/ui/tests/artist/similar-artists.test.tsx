import { act, render, cleanup, fireEvent } from "@testing-library/react";
import SimilarArtists from "@mahiru/ui/common/components/page/artist-v2/similar-artists";
import type { PropsWithChildren } from "react";
import type NeteaseAPIArtist from "@mahiru/ui/common/netease/api/artist";

const mocks = vi.hoisted(() => ({ similar: vi.fn(), logError: vi.fn() }));

vi.mock("@/common/netease/api", () => ({ NeteaseAPIArtist: { similar: mocks.similar } }));
vi.mock("@/common/lib/log", () => ({ Log: { error: mocks.logError } }));
vi.mock("@/common/netease/models", () => ({
  NeteaseNetworkImage: {
    fromURL: (src?: string) =>
      src
        ? {
            src,
            alt: "",
            setSize() {
              return this;
            },
            setAlt(alt: string) {
              this.alt = alt;
              return this;
            }
          }
        : undefined
  }
}));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: ({ className, image }: { className?: string; image?: { alt: string; src: string } }) => (
    <img className={className} src={image?.src} alt={image?.alt ?? ""} />
  )
}));
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
  default: ({ children }: PropsWithChildren) => <div role="list">{children}</div>
}));

type SimilarResponse = Awaited<ReturnType<typeof NeteaseAPIArtist.similar>>;
type SimilarArtist = NonNullable<SimilarResponse["artists"]>[number];

function artist(id: number, name = `Artist ${id}`): SimilarArtist {
  return {
    id,
    name,
    picUrl: `https://example.com/cover-${id}.jpg`,
    img1v1Url: `https://example.com/avatar-${id}.jpg`,
    albumSize: 24,
    musicSize: 99,
    alias: ["Alias"],
    trans: "Translated",
    transNames: ["Translated"]
  };
}

function response(...artists: SimilarArtist[]): SimilarResponse {
  return { code: 200, artists };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  mocks.similar.mockReset();
  mocks.logError.mockClear();
});
afterEach(cleanup);

it("excludes the current artist and duplicate IDs while using actual portrait and metadata fields", async () => {
  mocks.similar.mockResolvedValue(response(artist(1), artist(2), artist(2), artist(3)));
  const onClick = vi.fn();
  const view = render(<SimilarArtists id={1} onClick={onClick} />);

  const button = await view.findByRole("button", { name: /Artist 2/ });
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledExactlyOnceWith(2);
  expect(mocks.similar).toHaveBeenCalledExactlyOnceWith(1, expect.any(AbortSignal));
  expect(view.queryByRole("button", { name: /Artist 1/ })).not.toBeInTheDocument();
  expect(view.getAllByRole("button")).toHaveLength(2);
  expect(view.getAllByText("Translated / Alias")).toHaveLength(2);
  expect(view.getAllByText("99 首作品")).toHaveLength(2);
  expect(view.getByRole("img", { name: "Artist 2" })).toHaveAttribute(
    "src",
    "https://example.com/avatar-2.jpg"
  );
  expect(view.getByRole("img", { name: "Artist 2" })).toHaveClass("size-14", "rounded-full");
});

it("aborts replaced requests and ignores old responses that arrive after the artist changes", async () => {
  const first = deferred<SimilarResponse>();
  const second = deferred<SimilarResponse>();
  mocks.similar.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view = render(<SimilarArtists id={1} onClick={vi.fn()} />);
  const firstSignal = mocks.similar.mock.calls[0]![1] as AbortSignal;

  view.rerender(<SimilarArtists id={10} onClick={vi.fn()} />);
  expect(firstSignal.aborted).toBe(true);
  await act(async () => second.resolve(response(artist(11))));
  expect(await view.findByRole("button", { name: /Artist 11/ })).toBeInTheDocument();
  await act(async () => first.resolve(response(artist(2))));
  expect(view.queryByRole("button", { name: /Artist 2/ })).not.toBeInTheDocument();
  expect(view.getByRole("button", { name: /Artist 11/ })).toBeInTheDocument();
  const secondSignal = mocks.similar.mock.calls[1]![1] as AbortSignal;
  view.unmount();
  expect(secondSignal.aborted).toBe(true);
});

it("clears loaded artists while fetching the next artist and supports missing optional fields", async () => {
  const second = deferred<SimilarResponse>();
  mocks.similar.mockResolvedValueOnce(response(artist(2))).mockReturnValueOnce(second.promise);
  const view = render(<SimilarArtists id={1} onClick={vi.fn()} />);
  await view.findByRole("button", { name: /Artist 2/ });

  view.rerender(<SimilarArtists id={10} onClick={vi.fn()} />);
  expect(view.queryByRole("button", { name: /Artist 2/ })).not.toBeInTheDocument();
  expect(view.getByRole("status")).toHaveTextContent("正在加载相似歌手");
  await act(async () => second.resolve(response({ id: 11, name: "Minimal artist" })));
  expect(await view.findByRole("button", { name: "Minimal artist" })).toBeInTheDocument();
  expect(view.queryByText(/首作品/)).not.toBeInTheDocument();
});

it("offers retry after an API error and recovers to an empty result", async () => {
  mocks.similar
    .mockResolvedValueOnce({ code: 500, message: "暂不可用" })
    .mockResolvedValueOnce(response());
  const view = render(<SimilarArtists id={1} onClick={vi.fn()} />);

  fireEvent.click(await view.findByRole("button", { name: "相似歌手加载失败，点击重试" }));
  expect(await view.findByText("暂无相似歌手")).toBeInTheDocument();
  expect(mocks.similar).toHaveBeenCalledTimes(2);
  expect(mocks.logError).toHaveBeenCalledOnce();
});

it("shows request failures and allows a later successful retry", async () => {
  mocks.similar
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response(artist(2)));
  const view = render(<SimilarArtists id={1} onClick={vi.fn()} />);

  fireEvent.click(await view.findByRole("button", { name: "相似歌手加载失败，点击重试" }));
  expect(await view.findByRole("button", { name: /Artist 2/ })).toBeInTheDocument();
});

it("does not request an invalid artist ID", () => {
  const view = render(<SimilarArtists id={0} onClick={vi.fn()} />);
  expect(view.getByText("暂无相似歌手")).toBeInTheDocument();
  expect(mocks.similar).not.toHaveBeenCalled();
});
