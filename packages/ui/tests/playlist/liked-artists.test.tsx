import { render, cleanup, fireEvent } from "@testing-library/react";
import LikedArtists from "@mahiru/ui/common/components/page/playlist-v2/liked-artists";
import type { ReactNode } from "react";
import type { LikedArtist } from "@mahiru/ui/common/utils/liked-collection";

vi.mock("@/common/netease/models", () => ({
  NeteaseNetworkImage: {
    fromURL: (src: string) => ({
      src,
      setSize() {
        return this;
      }
    })
  }
}));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: ({ image }: { image: { src: string } }) => <img alt="" src={image.src} />
}));
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

function artist(id: number, name = `Artist ${id}`): LikedArtist {
  return {
    id,
    name,
    key: `id:${id}`,
    trackIDs: [id * 10, id * 10 + 1],
    covers: [`https://example.com/${id}.jpg`]
  };
}

afterEach(cleanup);

it("opens the selected artist within the liked collection without requiring an artist avatar", () => {
  const item = artist(1, "Artist Alpha");
  const onSelect = vi.fn();
  const view = render(
    <LikedArtists
      query=""
      totalCount={2}
      artists={[item, { ...artist(2), covers: [] }]}
      onSelect={onSelect}
    />
  );

  fireEvent.click(view.getByRole("button", { name: "Artist Alpha，已喜欢 2 首" }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(item);
  expect(view.container.querySelectorAll("img")).toHaveLength(1);
  expect(view.getByText("已加载 2 / 2 位歌手")).toBeInTheDocument();
  expect(view.queryByRole("textbox")).not.toBeInTheDocument();
});

it("renders supplied search results without filtering them again and distinguishes empty states", () => {
  const items = [artist(1, "Artist Alpha")];
  const onSelect = vi.fn();
  const view = render(
    <LikedArtists artists={items} totalCount={20} query="matching-alias" onSelect={onSelect} />
  );
  expect(view.getByRole("button", { name: "Artist Alpha，已喜欢 2 首" })).toBeInTheDocument();
  expect(view.getByText("已显示 1 / 1 位匹配歌手（共 20 位）")).toBeInTheDocument();
  view.rerender(<LikedArtists artists={[]} query="Missing" totalCount={20} onSelect={onSelect} />);
  expect(view.getByText("没有找到匹配的歌手")).toBeInTheDocument();
  view.rerender(<LikedArtists query="" artists={[]} totalCount={0} onSelect={onSelect} />);
  expect(view.getByText("暂无歌手")).toBeInTheDocument();
});

it("renders local pages and resets the page after a query or collection change", () => {
  const items = Array.from({ length: 85 }, (_, index) => artist(index + 1));
  const onSelect = vi.fn();
  const view = render(
    <LikedArtists query="" artists={items} totalCount={85} onSelect={onSelect} />
  );
  const cards = () => view.getAllByRole("button", { name: /已喜欢/ });

  expect(cards()).toHaveLength(40);
  expect(view.getByText("已加载 40 / 85 位歌手")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  expect(cards()).toHaveLength(80);
  expect(view.getByText("已加载 80 / 85 位歌手")).toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  expect(cards()).toHaveLength(85);
  expect(view.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();

  view.rerender(
    <LikedArtists artists={items} totalCount={85} query="new-query" onSelect={onSelect} />
  );
  expect(cards()).toHaveLength(40);
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  view.rerender(<LikedArtists query="" artists={items} totalCount={85} onSelect={onSelect} />);
  expect(cards()).toHaveLength(40);
  fireEvent.click(view.getByRole("button", { name: "加载更多" }));
  view.rerender(
    <LikedArtists query="" totalCount={82} artists={items.slice(0, 82)} onSelect={onSelect} />
  );
  expect(cards()).toHaveLength(40);
});
