vi.mock("@mahiru/ui/common/netease/api", () => ({
  NeteaseAPISearch: {
    hotListDetail: vi.fn()
  }
}));

import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { NeteaseAPISearch } from "@mahiru/ui/common/netease/api";
import HotRecommend from "@mahiru/ui/common/components/page/search/hot-recommend";

afterEach(cleanup);

const hotDetail = vi.mocked(NeteaseAPISearch.hotListDetail);

function hotItem(searchWord: string, score: number) {
  return {
    alg: "",
    url: "",
    score,
    source: 0,
    content: "",
    iconType: 0,
    searchWord,
    iconUrl: null
  };
}

beforeEach(() => {
  hotDetail.mockReset();
  hotDetail.mockResolvedValue({
    code: 200,
    message: "ok",
    trp: { rules: [] },
    data: [
      hotItem("The Weeknd", 74_000),
      hotItem("Undefined", 48_000),
      hotItem("雨爱", 42_000),
      hotItem("The Weeknd", 1_000)
    ]
  });
});

it("filters invalid and duplicate hot words, and searches on click", async () => {
  const onSearch = vi.fn();
  render(<HotRecommend onSearch={onSearch} />);

  await waitFor(() => expect(screen.getByText("实时趋势")).toBeInTheDocument());

  expect(screen.queryByText("Undefined")).toBeNull();
  expect(screen.getAllByText("The Weeknd")).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: /雨爱/ }));
  expect(onSearch).toHaveBeenCalledWith("雨爱");

  fireEvent.click(screen.getByRole("button", { name: "刷新热搜" }));
  await waitFor(() => expect(hotDetail).toHaveBeenCalledTimes(2));
});
