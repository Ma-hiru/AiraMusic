import { useLocation, RouterProvider, createMemoryRouter } from "react-router-dom";
import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import SearchControl from "@mahiru/ui/wins/display/pages/layout/search-control";
import type { MessageData } from "@mahiru/ipc/types";
import type { SearchProps } from "@mahiru/ui/common/components/page/search";

const mocks = vi.hoisted(() => {
  const channel = <T,>() => ({
    data: null as T | null,
    listeners: new Set<() => void>(),
    deliver: vi.fn(),
    addListener(callback: () => void) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    },
    publish(data: T) {
      this.data = data;
      for (const callback of this.listeners) callback();
    }
  });
  return {
    bus: {
      trackMeta: channel<MessageData<"bus_deliver_track_meta">>(),
      updater: { deliver: vi.fn() },
      playlistAction: { deliver: vi.fn() },
      comment: { deliver: vi.fn() }
    },
    pageRender: vi.fn(),
    keyword: "周杰伦"
  };
});

vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: { current: { addEventListener: vi.fn() }, comment: { reactReadyAwait: vi.fn() } }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/page/search", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function MockSearch(props: SearchProps) {
      mocks.pageRender(props);
      useImperativeHandle(props.ref, () => ({ currentKeyword: mocks.keyword, tracks: [] }));
      return (
        <section aria-label="搜索内容" data-variant={props.variant}>
          <button onClick={() => props.onClickAlbum(42)}>跳转专辑</button>
        </section>
      );
    }
  };
});

const routers: ReturnType<typeof createMemoryRouter>[] = [];
function setup(path = RoutePathDisplay.album as string) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <SearchControl />
            <LocationOutput />
            <AppDrawer.Provider />
          </>
        )
      }
    ],
    { initialEntries: [path] }
  );
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bus.trackMeta.data = null;
});
afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) router.dispose();
  vi.restoreAllMocks();
});

it("opens a drawer-variant search without taking over the page route", async () => {
  const create = vi.spyOn(AppDrawer, "_create");
  const view = setup();

  fireEvent.click(view.getByRole("button", { name: "搜索" }));
  expect(await view.findByRole("dialog", { name: "搜索" })).toBeInTheDocument();
  expect(create).toHaveBeenCalledOnce();
  expect(mocks.pageRender.mock.lastCall?.[0]).toMatchObject({
    variant: "drawer",
    routerActive: false
  });
  expect(view.getByLabelText("搜索内容")).toHaveAttribute("data-variant", "drawer");
  expect(view.getByTestId("location")).toHaveTextContent(RoutePathDisplay.album);
  expect(mocks.bus.updater.deliver).toHaveBeenCalledWith("track-meta");
});

it("closes the drawer after jumping to an album so the target page is visible", async () => {
  const view = setup();
  fireEvent.click(view.getByRole("button", { name: "搜索" }));
  const dialog = await view.findByRole("dialog", { name: "搜索" });

  fireEvent.click(within(dialog).getByRole("button", { name: "跳转专辑" }));
  await waitFor(() =>
    expect(view.getByTestId("location")).toHaveTextContent(
      RoutePath.withQuery(RoutePathDisplay.album, { id: 42 })
    )
  );
  await waitFor(() => expect(AppDrawer.__visibleGetter()).toBe(false));
});

it("expands to the search page carrying the current keyword", async () => {
  const view = setup();
  fireEvent.click(view.getByRole("button", { name: "搜索" }));
  const dialog = await view.findByRole("dialog", { name: "搜索" });

  act(() => fireEvent.click(within(dialog).getByRole("button", { name: "展开搜索页" })));
  await waitFor(() =>
    expect(view.getByTestId("location")).toHaveTextContent(
      RoutePath.withQuery(RoutePathDisplay.search, { keyword: mocks.keyword })
    )
  );
  expect(AppDrawer.__visibleGetter()).toBe(false);
});

it("hides the entry once the search page is mounted", () => {
  const view = setup(RoutePathDisplay.search);
  expect(view.queryByRole("button", { name: "搜索" })).not.toBeInTheDocument();
});
