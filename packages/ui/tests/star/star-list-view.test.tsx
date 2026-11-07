vi.mock("@mahiru/ui/common/components/display/image/netease-image", () => ({
  default: ({ className }: { className?: string }) => <span className={className} />
}));

import { render, cleanup, fireEvent } from "@testing-library/react";
import StarListView from "@mahiru/ui/common/components/page/star/list-view";
import type { MediaItem } from "@mahiru/ui/common/components/layout/media-grid/card";

afterEach(cleanup);

const items: MediaItem[] = [
  {
    id: 1,
    name: "夜行电台",
    meta: "仲商贰肆",
    badge: "18 首",
    playCount: 24000,
    coverUrl: "https://example.com/1.jpg"
  },
  {
    id: 2,
    name: "Nao",
    meta: "Alias",
    badge: "专辑 8",
    shape: "circle",
    coverUrl: "https://example.com/2.jpg"
  }
];

it("renders rows with meta and play count", () => {
  const { getByText } = render(<StarListView items={items} />);

  expect(getByText("夜行电台")).toBeInTheDocument();
  expect(getByText("仲商贰肆 · 18 首")).toBeInTheDocument();
  expect(getByText("2.4W")).toBeInTheDocument();
  expect(getByText("Nao")).toBeInTheDocument();
  expect(getByText("Alias · 专辑 8")).toBeInTheDocument();
});

it("forwards click and context menu events", () => {
  const onClickItem = vi.fn();
  const onContextItem = vi.fn();
  const { getAllByRole } = render(
    <StarListView items={items} onClickItem={onClickItem} onContextItem={onContextItem} />
  );
  const rows = getAllByRole("button");

  fireEvent.click(rows[0]!);
  expect(onClickItem).toHaveBeenCalledWith(1);

  fireEvent.contextMenu(rows[1]!);
  expect(onContextItem).toHaveBeenCalledWith(expect.anything(), 2, 1);
});
