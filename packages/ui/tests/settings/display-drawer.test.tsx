import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import SettingsDisplay from "@mahiru/ui/wins/display/pages/settings";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import SettingsControl from "@mahiru/ui/wins/display/pages/layout/settings-control";
import type { SettingsTab } from "@mahiru/ui/common/components/page/settings";

vi.mock("@/wins/display/hooks/use-display-title", () => ({ useDisplayTitleRegister: vi.fn() }));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { output: { data: null, addListener: () => () => {} } }
}));
vi.mock("@/common/lib/window", () => ({ RendererWindow: { main: { send: vi.fn() } } }));
vi.mock("@/common/lib/output", () => ({ RendererOutput: { DEFAULT_DEVICE_ID: "default" } }));
vi.mock("@/common/store/user", () => ({ useUser: () => null }));
vi.mock("@/common/store/settings", () => ({
  useSettings: () => ({}),
  settingsStoreSnapshot: () => ({ updateSettings: vi.fn() })
}));
vi.mock("@/common/netease/services", () => ({ NeteaseServicesAuth: { logout: vi.fn() } }));
vi.mock("@/common/components/page/settings", () => ({
  default: ({
    onTabChange,
    tab,
    inDrawer
  }: {
    tab?: SettingsTab;
    inDrawer?: boolean;
    onTabChange: (tab: SettingsTab) => void;
  }) => (
    <section data-tab={tab} aria-label="设置内容" data-mode={inDrawer ? "drawer" : "page"}>
      <button type="button" onClick={() => onTabChange("agent")}>
        Agent
      </button>
      <button type="button" onClick={() => onTabChange("general")}>
        常规设置
      </button>
    </section>
  )
}));

afterEach(cleanup);

it("在当前页面打开设置抽屉，展开时保留分类并随路由隐藏顶栏入口", async () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <SettingsControl />
            <Outlet />
            <AppDrawer.Provider />
          </>
        ),
        children: [
          { path: RoutePathDisplay.blank, element: <p>展示窗</p> },
          { path: RoutePathDisplay.settings, element: <SettingsDisplay /> }
        ]
      }
    ],
    { initialEntries: [RoutePathDisplay.blank] }
  );
  const view = render(<RouterProvider router={router} />);
  try {
    fireEvent.click(view.getByRole("button", { name: "设置" }));
    const drawer = await view.findByRole("dialog", { name: "设置" });
    expect(router.state.location.pathname).toBe(RoutePathDisplay.blank);
    expect(within(drawer).getByLabelText("设置内容")).toHaveAttribute("data-mode", "drawer");

    fireEvent.click(within(drawer).getByRole("button", { name: "Agent" }));
    fireEvent.click(within(drawer).getByRole("button", { name: "展开设置页" }));
    await waitFor(() => expect(drawer).not.toBeInTheDocument());
    expect(RoutePath.parseQuery(router.state.location, RoutePathDisplay.settings)).toEqual({
      tab: "agent"
    });
    expect(view.getByLabelText("设置内容")).toHaveAttribute("data-mode", "page");
    expect(view.getByLabelText("设置内容")).toHaveAttribute("data-tab", "agent");
    expect(view.queryByRole("button", { name: "设置" })).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "常规设置" }));
    expect(router.state.location.search).toBe("");
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe(RoutePathDisplay.blank);
    expect(view.getByRole("button", { name: "设置" })).toBeInTheDocument();
  } finally {
    router.dispose();
  }
});
