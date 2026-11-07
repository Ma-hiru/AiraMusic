import { render, cleanup, fireEvent } from "@testing-library/react";
import StarTabs from "@mahiru/ui/common/components/page/star/tabs";

afterEach(cleanup);

it("marks the active category and emits the selected category", () => {
  const onChange = vi.fn();
  const { getByRole } = render(<StarTabs active="playlist" onChange={onChange} />);

  const playlist = getByRole("button", { name: "歌单" });
  expect(playlist).toHaveAttribute("aria-pressed", "true");

  const album = getByRole("button", { name: "专辑" });
  expect(album).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(album);
  expect(onChange).toHaveBeenCalledWith("album");
});
