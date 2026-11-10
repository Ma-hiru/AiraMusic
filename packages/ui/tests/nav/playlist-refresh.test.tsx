import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Nav from "@mahiru/ui/wins/main/pages/layout/nav";
import type { ReactNode, ComponentProps } from "react";
import type NavFloat from "@mahiru/ui/wins/main/pages/layout/nav/float";

const mocks = vi.hoisted(() => ({
  sidebar: true,
  user: { userId: 1, isLoggedIn: true, playlistCount: 1 } as null | {
    userId: number;
    isLoggedIn: boolean;
    playlistCount: number;
  },
  modified: vi.fn(),
  floatProps: vi.fn<(props: ComponentProps<typeof NavFloat>) => void>()
}));

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: () => mocks.sidebar
}));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/hooks/use-stage", () => ({ useStage: () => ({ stage: 0 }) }));
vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { modified: { twoWay: mocks.modified } }
}));
vi.mock("@/common/components/display/modal", () => ({
  default: { useModal: () => ({ create: vi.fn() }) },
  createPlaylistCreateModal: vi.fn()
}));
vi.mock("@/wins/main/pages/layout/nav/tab", () => ({ default: () => null }));
vi.mock("@/wins/main/pages/layout/nav/nav-menu", () => ({ default: () => null }));
vi.mock("@/wins/main/pages/layout/nav/nav-playlist", () => ({ default: () => null }));
vi.mock("@/wins/main/pages/layout/nav/float", async (importOriginal) => {
  const { default: Float } =
    await importOriginal<typeof import("@mahiru/ui/wins/main/pages/layout/nav/float")>();
  return {
    default: (props: ComponentProps<typeof Float>) => {
      mocks.floatProps(props);
      return <Float {...props} />;
    }
  };
});
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.sidebar = true;
  mocks.user = { userId: 1, isLoggedIn: true, playlistCount: 1 };
  mocks.modified.mockReset();
  mocks.floatProps.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("uses the real RotateCw entry and shares the playlist refresh callback with creation", () => {
  const view = render(<Nav />);
  const refresh = view.getByLabelText("刷新歌单");
  const props = mocks.floatProps.mock.lastCall![0];

  expect(refresh).toHaveClass("lucide-rotate-cw");
  expect(refresh.querySelector("title")).toHaveTextContent("刷新歌单");
  expect(props.onRefresh).toBeTypeOf("function");
  expect(props.onCreated).toBe(props.onRefresh);

  fireEvent.click(refresh);

  expect(mocks.modified).toHaveBeenCalledExactlyOnceWith({ type: "user-playlist" });
});

it.each([
  { name: "logged out", user: { userId: 1, isLoggedIn: false, playlistCount: 1 }, sidebar: true },
  { name: "without a user", user: null, sidebar: true },
  { name: "collapsed", user: { userId: 1, isLoggedIn: true, playlistCount: 1 }, sidebar: false }
])("does not expose refresh when $name", ({ user, sidebar }) => {
  mocks.user = user;
  mocks.sidebar = sidebar;
  const view = render(<Nav />);

  expect(view.queryByLabelText("刷新歌单")).not.toBeInTheDocument();
  expect(mocks.modified).not.toHaveBeenCalled();
});

it("hides refresh with the floating controls after inactivity and restores it on hover", () => {
  const view = render(<Nav />);
  const controls = view.getByLabelText("刷新歌单").closest("section")!;

  act(() => vi.advanceTimersByTime(2000));

  expect(view.queryByLabelText("刷新歌单")).not.toBeInTheDocument();
  fireEvent.mouseOver(controls);
  fireEvent.click(view.getByLabelText("刷新歌单"));
  expect(mocks.modified).toHaveBeenCalledExactlyOnceWith({ type: "user-playlist" });
});
