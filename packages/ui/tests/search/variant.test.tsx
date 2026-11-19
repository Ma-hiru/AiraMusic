import { createRef } from "react";
import { render, screen, within, cleanup, fireEvent } from "@testing-library/react";
import Search, { type SearchRef, type SearchProps } from "@mahiru/ui/common/components/page/search";

vi.mock("@/common/hooks/use-agent-focus-ctx", () => ({ useAgentFocusCtx: vi.fn() }));
vi.mock("@/common/components/page/search/input", () => ({
  default: ({ onSearch }: { onSearch: NormalFunc<[keyword: string]> }) => (
    <button type="button" onClick={() => onSearch("  晴天  ")}>
      提交搜索
    </button>
  )
}));
vi.mock("@/common/components/page/search/hot-recommend", () => ({
  default: () => <div>hot-recommend</div>
}));
vi.mock("@/common/components/page/search/content", () => ({
  TrackResult: () => <div>tracks-result</div>,
  AlbumResult: () => <div>albums-result</div>,
  PlaylistResult: () => <div>playlists-result</div>,
  ArtistResult: () => <div>artists-result</div>
}));

const baseProps: Omit<SearchProps, "ref"> = {
  routerActive: false,
  coverSize: 0 as SearchProps["coverSize"],
  activeTrackID: undefined,
  heartManager: {} as SearchProps["heartManager"],
  playableManager: () => ({ playable: true, reason: "" }),
  addToPlaylistLast: vi.fn(),
  addToPlaylistNext: vi.fn(),
  addTrackToPlaylist: vi.fn(),
  openComment: vi.fn(),
  onClickAlbum: vi.fn(),
  onClickArtist: vi.fn(),
  onClickPlaylist: vi.fn(),
  onClickTrack: vi.fn()
};

afterEach(cleanup);

it("keeps the page header and sidebar tab list for the page variant", () => {
  render(<Search {...baseProps} variant="page" />);

  expect(screen.getByRole("heading", { name: "搜索" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "搜索结果类型" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "搜索结果类型" })).toBeNull();
  expect(screen.getByText("Matches")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /单曲/ })).toHaveAttribute("aria-pressed", "true");
});

it("swaps the page header for a compact tab bar in the drawer variant", () => {
  render(<Search {...baseProps} variant="drawer" />);

  expect(screen.queryByRole("heading", { name: "搜索" })).toBeNull();
  expect(screen.queryByText("Matches")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "搜索结果类型" })).toBeNull();

  const tabs = within(screen.getByRole("group", { name: "搜索结果类型" })).getAllByRole("button");
  expect(tabs.map((tab) => tab.textContent)).toEqual(["单曲", "专辑", "歌单", "歌手"]);
  expect(screen.getByRole("button", { name: "单曲" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("0 条")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "专辑" }));
  expect(screen.getByRole("button", { name: "专辑" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("albums-result")).toBeInTheDocument();
});

it("submits a search from the drawer without a title callback", () => {
  const searchRef = createRef<SearchRef>();
  render(<Search {...baseProps} ref={searchRef} variant="drawer" />);

  fireEvent.click(screen.getByRole("button", { name: "提交搜索" }));

  expect(searchRef.current?.currentKeyword).toBe("晴天");
});
