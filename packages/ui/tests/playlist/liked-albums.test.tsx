import { render, cleanup, fireEvent } from "@testing-library/react";
import LikedAlbums from "@mahiru/ui/common/components/page/playlist-v2/liked-albums";
import type { ReactNode } from "react";
import type { LikedAlbum } from "@mahiru/ui/common/utils/liked-collection";
import type { MediaItem } from "@mahiru/ui/common/components/layout/media-grid/card";

vi.mock("@/common/components/layout/infinite/infinite-container", () => ({
  default: ({
    onLoadMore,
    hasMore,
    children
  }: {
    hasMore: boolean;
    children: ReactNode;
    onLoadMore: () => void;
  }) => (
    <div role="list">
      {children}
      {hasMore && <button onClick={onLoadMore}>加载更多</button>}
    </div>
  )
}));
vi.mock("@/common/components/layout/media-grid/card", () => ({
  default: ({ onClick, item }: { item: MediaItem; onClick: (id: number) => void }) => (
    <button onClick={() => onClick(item.id)}>
      {item.name} {item.meta} {item.badge}
    </button>
  )
}));

function album(id: number, name = `Album ${id}`): LikedAlbum {
  return {
    id,
    name,
    key: `id:${id}`,
    artist: `Artist ${id}`,
    trackIDs: [id * 10, id * 10 + 1],
    cover: `https://example.com/${id}.jpg`
  };
}

afterEach(cleanup);

it("opens the exact supplied album group even when names and IDs are shared", () => {
  const first = { ...album(0, "Shared album"), key: "first", artist: "First artist" };
  const second = { ...album(0, "Shared album"), key: "second", artist: "Second artist" };
  const onSelect = vi.fn();
  const view = render(
    <LikedAlbums query="" totalCount={2} albums={[first, second]} onSelect={onSelect} />
  );

  fireEvent.click(view.getByRole("button", { name: "Shared album Second artist 已喜欢 2 首" }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(second);
  expect(view.getByText("已加载 2 / 2 张专辑")).toBeInTheDocument();
  expect(view.queryByRole("textbox")).not.toBeInTheDocument();
});

it("renders prefiltered album results without applying its own matching and shows empty states", () => {
  const onSelect = vi.fn();
  const view = render(
    <LikedAlbums totalCount={10} albums={[album(1)]} query="matching-artist" onSelect={onSelect} />
  );

  expect(view.getByRole("button", { name: "Album 1 Artist 1 已喜欢 2 首" })).toBeInTheDocument();
  expect(view.getByText("已显示 1 / 1 张匹配专辑（共 10 张）")).toBeInTheDocument();
  view.rerender(<LikedAlbums albums={[]} query="Missing" totalCount={10} onSelect={onSelect} />);
  expect(view.getByText("没有找到匹配的专辑")).toBeInTheDocument();
  view.rerender(<LikedAlbums query="" albums={[]} totalCount={0} onSelect={onSelect} />);
  expect(view.getByText("暂无专辑")).toBeInTheDocument();
});

it("paginates only the rendered cards and resets on query or album collection changes", () => {
  const items = Array.from({ length: 85 }, (_, index) => album(index + 1));
  const onSelect = vi.fn();
  const view = render(<LikedAlbums query="" albums={items} totalCount={85} onSelect={onSelect} />);
  const cards = () => view.getAllByRole("button", { name: /已喜欢/ });

  expect(cards()).toHaveLength(40);
  expect(view.getByText("已加载 40 / 85 张专辑")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  expect(cards()).toHaveLength(80);
  expect(view.getByText("已加载 80 / 85 张专辑")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  expect(cards()).toHaveLength(85);
  expect(view.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();

  view.rerender(
    <LikedAlbums albums={items} totalCount={85} query="new-query" onSelect={onSelect} />
  );
  expect(cards()).toHaveLength(40);
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  view.rerender(<LikedAlbums query="" albums={items} totalCount={85} onSelect={onSelect} />);
  expect(cards()).toHaveLength(40);
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  view.rerender(
    <LikedAlbums query="" totalCount={82} albums={items.slice(0, 82)} onSelect={onSelect} />
  );
  expect(cards()).toHaveLength(40);
});
