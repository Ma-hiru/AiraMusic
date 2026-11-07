import { act, render, cleanup, renderHook } from "@testing-library/react";
import { PlaylistPathUtils } from "@mahiru/ui/common/routes/utils";
import { RoutePathMain, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useDisplayAction } from "@mahiru/ui/wins/main/hooks/use-display-action";
import { useDisplayPageAction } from "@mahiru/ui/wins/display/hooks/use-display-page-action";
import LayoutDisplay from "@mahiru/ui/wins/display/pages/layout";
import type { ReactNode } from "react";
import type { Location } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/types";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  markBack: vi.fn(),
  displayReady: vi.fn(),
  focus: vi.fn(),
  location: {
    pathname: "/blank",
    search: "",
    hash: "",
    state: null,
    key: "test",
    unstable_mask: undefined as Location["unstable_mask"]
  },
  display: { type: "display", data: [] as MessageData<"bus_display">[], deliver: vi.fn() },
  modified: { type: "modified", data: [] },
  consume: vi.fn(),
  update: vi.fn()
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location
}));
vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: { focus: mocks.focus },
    display: { reactReadyAwait: mocks.displayReady }
  }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    display: mocks.display,
    modified: mocks.modified,
    consume: mocks.consume,
    updater: { deliver: mocks.update }
  }
}));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { mark: vi.fn() } }));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));
vi.mock("@/wins/display/ctx/back", () => ({
  useBack: () => ({ markBack: mocks.markBack }),
  BackCtx: ({ children }: { children?: ReactNode }) => <>{children}</>
}));
vi.mock("@/common/components/layout/drag/drag", () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>
}));
vi.mock("@/common/components/display/modal", () => ({ default: { Provider: () => null } }));
vi.mock("@/common/components/display/toast", () => ({ default: { Provider: () => null } }));
vi.mock("@/common/components/display/menu", () => ({ default: { Provider: () => null } }));
vi.mock("@/common/components/layout/top/back", () => ({ default: () => null }));
vi.mock("@/common/components/layout/top/control", () => ({ default: () => null }));
vi.mock("@/common/components/other/keep-alive-outlet", () => ({ default: () => null }));
vi.mock("@/common/components/fallback/app-error-boundary", () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>
}));
vi.mock("@/wins/display/pages/layout/title", () => ({ default: () => null }));
vi.mock("@/wins/display/pages/layout/float", () => ({ default: () => null }));
vi.mock("@/wins/display/pages/layout/background", () => ({ default: () => null }));

const scopes: PlaylistScope[] = [
  { kind: "artist", key: "id:17" },
  { kind: "artist", key: "name:歌手 A / B & C" },
  { kind: "album", key: "id:25" }
];

function location(url: string): Location {
  const parsed = new URL(url, "https://example.com");
  return {
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    state: null,
    key: "test",
    unstable_mask: undefined
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.display.data = [];
  mocks.location = location("/blank");
  mocks.displayReady.mockResolvedValue(undefined);
});
afterEach(cleanup);

it.each(scopes)("round-trips $kind scope $key through playlist query encoding", (scope) => {
  const route = new PlaylistPathUtils("/playlist");
  for (const source of ["like", "normal"] as const) {
    const url = route.withQuery(42, source, scope);
    const result = route.parseQuery(location(url));
    expect(result).toEqual({ id: "42", source, scope });
  }
});

it("keeps existing playlist URLs and missing scope fields compatible", () => {
  const route = new PlaylistPathUtils("/playlist");
  expect(route.like).toBe("/playlist?source=like");
  expect(route.withQuery(42, "normal")).toBe("/playlist?id=42&source=normal");
  expect(route.parseQuery(location(route.like))).toEqual({ id: null, source: "like" });
  expect(route.parseQuery(location(route.withQuery(42, "normal")))).toEqual({
    id: "42",
    source: "normal"
  });
});

it("clears cached scope when navigating to an ordinary unscoped playlist link", () => {
  const route = new PlaylistPathUtils("/playlist");
  const scope = scopes[0]!;
  route.parseQuery(location(route.withQuery(42, "like", scope)));
  expect(route.parseQuery(location("/home")).scope).toEqual(scope);
  expect(route.parseQuery(location("/home"), false)).toEqual({ id: null, source: null });
  expect(route.parseQuery(location("/home")).scope).toEqual(scope);
  route.parseQuery(location(route.withQuery(42, "normal")));
  expect(route.parseQuery(location("/home")).scope).toBeUndefined();
});

it.each(["{", "null", "[]", '{"kind":"unknown","key":"id:1"}', '{"kind":"artist","key":1}'])(
  "ignores invalid scope query %s without breaking the playlist route",
  (scope) => {
    const route = new PlaylistPathUtils("/playlist");
    const params = new URLSearchParams({ id: "42", source: "like", scope });
    expect(route.parseQuery(location(`/playlist?${params}`))).toEqual({
      id: "42",
      source: "like"
    });
  }
);

it("reads the latest selected scope when splitting instead of evaluating the factory during render", async () => {
  let scope = scopes[0]!;
  const factory = vi.fn(
    (): MessageData<"bus_display"> => ({
      type: "playlist",
      id: 42,
      source: "like",
      scope
    })
  );
  const view = renderHook(() => useDisplayAction(factory));
  expect(factory).not.toHaveBeenCalled();
  scope = scopes[2]!;

  await act(() => view.result.current.onPageAction());

  expect(factory).toHaveBeenCalledOnce();
  expect(mocks.displayReady).toHaveBeenCalledOnce();
  expect(mocks.display.deliver).toHaveBeenCalledExactlyOnceWith({
    type: "playlist",
    id: 42,
    source: "like",
    scope
  });
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(-1);
});

it("reads the latest selected scope when merging a display playlist into main", async () => {
  let scope = scopes[0]!;
  const factory = vi.fn(
    (): MessageData<"bus_display"> => ({
      type: "playlist",
      id: 42,
      source: "like",
      scope
    })
  );
  const view = renderHook(() => useDisplayPageAction(factory));
  expect(factory).not.toHaveBeenCalled();
  scope = scopes[1]!;

  await act(() => view.result.current.onPageAction());

  expect(mocks.display.deliver).toHaveBeenCalledExactlyOnceWith(
    { type: "playlist", id: 42, source: "like", scope },
    "main"
  );
  expect(mocks.markBack).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(-1);
});

it("preserves static unscoped messages and skips null factories", async () => {
  const split = renderHook(() => useDisplayAction({ type: "playlist", id: 42, source: "normal" }));
  await act(() => split.result.current.onPageAction());
  expect(mocks.display.deliver).toHaveBeenCalledExactlyOnceWith({
    type: "playlist",
    id: 42,
    source: "normal"
  });
  mocks.display.deliver.mockClear();
  mocks.navigate.mockClear();
  mocks.displayReady.mockClear();
  const empty = renderHook(() => useDisplayAction(() => null));
  await act(() => empty.result.current.onPageAction());
  expect(mocks.display.deliver).not.toHaveBeenCalled();
  expect(mocks.displayReady).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it.each([...scopes, undefined])(
  "carries optional scope %s through the display message receiver",
  (scope) => {
    mocks.display.data = [
      { type: "playlist", id: 42, source: "like", ...(scope ? { scope } : {}) }
    ];
    render(<LayoutDisplay />);

    const expected = RoutePathDisplay.playlist.withQuery(42, "like", scope);
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(expected);
    const target = location(mocks.navigate.mock.calls[0]![0]);
    expect(RoutePathDisplay.playlist.parseQuery(target).scope).toEqual(scope);
    expect(mocks.focus).toHaveBeenCalledOnce();
  }
);

it("keeps a selected scope through main splitting, display navigation and merging back", async () => {
  const selected = { current: scopes[1]! };
  const split = renderHook(() =>
    useDisplayAction(() => ({ type: "playlist", id: 42, source: "like", scope: selected.current }))
  );
  await act(() => split.result.current.onPageAction());
  const outward = mocks.display.deliver.mock.calls[0]![0] as MessageData<"bus_display">;
  mocks.display.data = [outward];
  mocks.navigate.mockClear();
  render(<LayoutDisplay />);
  const displayRoute = location(mocks.navigate.mock.calls[0]![0]);
  const displayScope = RoutePathDisplay.playlist.parseQuery(displayRoute).scope;
  expect(displayScope).toEqual(selected.current);
  const merge = renderHook(() =>
    useDisplayPageAction(() => ({ type: "playlist", id: 42, source: "like", scope: displayScope }))
  );
  mocks.display.deliver.mockClear();
  await act(() => merge.result.current.onPageAction());
  const inward = mocks.display.deliver.mock.calls[0]![0] as Extract<
    MessageData<"bus_display">,
    { type: "playlist" }
  >;
  const mainRoute = RoutePathMain.playlist.withQuery(inward.id, inward.source, inward.scope);
  expect(RoutePathMain.playlist.parseQuery(location(mainRoute)).scope).toEqual(selected.current);
});
