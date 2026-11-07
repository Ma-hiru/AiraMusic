import { render, cleanup, fireEvent } from "@testing-library/react";
import Star from "@mahiru/ui/common/components/page/star";

afterEach(cleanup);

it("shows login guidance when logged out and triggers login", () => {
  const onLogin = vi.fn();
  const { getByRole, getByText } = render(<Star user={null} onLogin={onLogin} routerActive />);

  expect(getByText("收藏")).toBeInTheDocument();
  expect(getByText("登录后查看你的收藏")).toBeInTheDocument();

  fireEvent.click(getByRole("button", { name: "去登录" }));
  expect(onLogin).toHaveBeenCalledTimes(1);
});
