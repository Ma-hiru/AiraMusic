import { Provider, createStore } from "jotai";
import { act, cleanup, renderHook } from "@testing-library/react";
import { playModalAtom } from "@mahiru/ui/wins/main/atoms/layout";
import { useSpectrumActive } from "@mahiru/ui/wins/main/hooks/use-spectrum-active";
import type { PropsWithChildren } from "react";

const state = vi.hoisted(() => ({
  window: { isShow: true, isMin: false, addListener: () => () => {} },
  performance: { playerSpectrum: true, barSpectrum: true }
}));
vi.mock("@/common/lib/window", () => ({ RendererWindow: { current: state.window } }));
vi.mock("@/common/store/settings", () => ({ useSettings: () => state }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shares visibility, playback, page and setting gates between analysis and both views", () => {
  const store = createStore();
  store.set(playModalAtom, false);
  state.window.isShow = true;
  state.window.isMin = false;
  state.performance.playerSpectrum = true;
  state.performance.barSpectrum = true;
  let visible = true;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
    visible ? "visible" : "hidden"
  );
  const { result, rerender } = renderHook(
    ({ playing }) => ({
      analysis: useSpectrumActive(playing),
      player: useSpectrumActive(playing, "player"),
      bar: useSpectrumActive(playing, "bar")
    }),
    {
      initialProps: { playing: true },
      wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>
    }
  );
  const stopped = { analysis: false, player: false, bar: false };
  expect(result.current).toEqual({ analysis: true, player: false, bar: true });
  rerender({ playing: false });
  expect(result.current).toEqual(stopped);
  rerender({ playing: true });

  state.window.isShow = false;
  rerender({ playing: true });
  expect(result.current).toEqual(stopped);
  state.window.isShow = true;
  state.window.isMin = true;
  rerender({ playing: true });
  expect(result.current).toEqual(stopped);
  state.window.isMin = false;
  rerender({ playing: true });
  expect(result.current.bar).toBe(true);

  act(() => {
    visible = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current).toEqual(stopped);
  act(() => {
    visible = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.bar).toBe(true);

  // 当前页面的频谱关闭时，即使另一页面的开关打开，也不分析。
  state.performance.barSpectrum = false;
  rerender({ playing: true });
  expect(result.current).toEqual(stopped);
  act(() => store.set(playModalAtom, true));
  expect(result.current).toEqual({ analysis: true, player: true, bar: false });
  state.performance.playerSpectrum = false;
  rerender({ playing: true });
  expect(result.current).toEqual(stopped);
});
