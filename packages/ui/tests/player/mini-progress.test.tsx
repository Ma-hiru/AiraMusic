import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { RendererIPCMessageBus } from "@mahiru/ui/common/lib/bus";
import MiniProgress from "@mahiru/ui/wins/mini/page/mini-progress";

const preferences = vi.hoisted(() => ({
  useWavePlayerProgress: true,
  useWaveMiniPlayerProgress: false
}));

vi.mock("@/common/store/settings", () => ({ useSettings: () => ({ preference: preferences }) }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesTrack: { chorus: () => Promise.resolve({ chorus: [] }) }
}));

const track = { id: 42, dt: 100_000 } as NeteaseTrackModel;
const snapshot = { trackID: track.id, currentTime: 32, duration: 100, buffered: 88, volume: 1 };

beforeEach(() => {
  preferences.useWaveMiniPlayerProgress = false;
  RendererIPCMessageBus.progress.data = null;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(216);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(12);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("switches from normal to wave with the latest paused timeline and sends one seek on release", async () => {
  RendererIPCMessageBus.progress.data = snapshot;
  const send = vi.spyOn(RendererIPCMessageBus.playerAction, "deliver").mockImplementation(() => {});
  const props = { track, color: "white", playing: false, visible: true };
  const view = render(<MiniProgress {...props} />);
  expect(view.getByRole("slider")).toHaveAttribute("aria-valuenow", "32");
  expect(view.getByRole("slider").querySelector("svg")).not.toBeInTheDocument();

  preferences.useWaveMiniPlayerProgress = true;
  view.rerender(<MiniProgress {...props} color="black" />);
  const slider = view.getByRole("slider");
  expect(slider).toHaveAttribute("aria-valuenow", "32");
  expect(slider.querySelector("svg")).toHaveAttribute("viewBox", "0 0 216 12");
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(new DOMRect(48, 0, 216, 12));

  fireEvent.pointerDown(slider, { pointerId: 1, button: 0, clientX: 102 });
  fireEvent.pointerMove(slider, { pointerId: 1, clientX: 156 });
  expect(send).not.toHaveBeenCalled();
  fireEvent.pointerUp(slider, { pointerId: 1, clientX: 156 });
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "seek", trackID: track.id, percent: 50 });

  await act(async () =>
    RendererIPCMessageBus.progress.dispatch({ ...snapshot, currentTime: 49, immediate: true })
  );
  await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "49"));
});

it("keeps seek inert until the timeline matches the current track", async () => {
  RendererIPCMessageBus.progress.data = { ...snapshot, trackID: 17 };
  const view = render(<MiniProgress color="white" track={track} playing={false} visible />);
  const slider = view.container.querySelector('[role="slider"]')!;
  expect(slider.closest("[inert]")).toBeInTheDocument();
  expect(slider).toHaveAttribute("aria-valuenow", "0");

  await act(async () => RendererIPCMessageBus.progress.dispatch(snapshot));
  await waitFor(() => expect(slider.closest("[inert]")).not.toBeInTheDocument());
  expect(slider).toHaveAttribute("aria-valuenow", "32");
});
