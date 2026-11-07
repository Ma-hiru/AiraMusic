import { render, cleanup, fireEvent } from "@testing-library/react";
import StarHeader from "@mahiru/ui/common/components/page/star/header";

afterEach(cleanup);

it("switches the view mode and triggers a refresh", () => {
  const onViewModeChange = vi.fn();
  const onRefresh = vi.fn();
  const { getByRole } = render(
    <StarHeader
      viewMode="grid"
      active="playlist"
      counts={{ playlist: 12 }}
      onRefresh={onRefresh}
      onViewModeChange={onViewModeChange}
    />
  );

  expect(getByRole("button", { name: "网格视图" })).toHaveAttribute("aria-pressed", "true");
  expect(getByRole("button", { name: "列表视图" })).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(getByRole("button", { name: "列表视图" }));
  expect(onViewModeChange).toHaveBeenCalledWith("list");

  fireEvent.click(getByRole("button", { name: "刷新" }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it("hides view and refresh actions when tabs are not shown", () => {
  const { queryByRole } = render(
    <StarHeader showTabs={false} active="playlist" counts={{ playlist: 0 }} />
  );

  expect(queryByRole("button", { name: "刷新" })).toBeNull();
  expect(queryByRole("button", { name: "列表视图" })).toBeNull();
});
