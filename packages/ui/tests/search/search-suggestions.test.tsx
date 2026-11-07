import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SearchSuggestions, {
  type Suggestion
} from "@mahiru/ui/common/components/page/search/input/search-suggestions";

afterEach(cleanup);

const suggestions: Suggestion[] = [
  { id: 1, name: "Automotivo", type: "tracks" },
  { id: 2, name: "Mary", type: "tracks" },
  { id: 3, name: "平凡的一天", type: "playlists" },
  { id: 4, name: "毛不易", type: "artists" }
];

it("groups suggestions by type and handles item/search-all clicks", () => {
  const onClick = vi.fn();
  const onSearchAll = vi.fn();
  render(
    <SearchSuggestions
      keyword="ma"
      suggestions={suggestions}
      onClick={onClick}
      onSearchAll={onSearchAll}
    />
  );

  expect(screen.getByText("单曲")).toBeInTheDocument();
  expect(screen.getByText("歌单")).toBeInTheDocument();
  expect(screen.getByText("歌手")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Mary" }));
  expect(onClick).toHaveBeenCalledWith(suggestions[1]);

  fireEvent.click(screen.getByRole("button", { name: /搜索 “ma”/ }));
  expect(onSearchAll).toHaveBeenCalledTimes(1);
});
