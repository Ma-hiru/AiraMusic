import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import RadioMeta from "@mahiru/ui/wins/radio/page/radio-meta";

const mocks = vi.hoisted(() => ({
  bus: {
    progress: { data: undefined },
    trackMeta: { data: { repeat: "off" as "all" | "off" | "one" } },
    playlistAction: { deliver: vi.fn() },
    playerAction: { deliver: vi.fn() }
  }
}));

vi.mock("@/common/lib/bus", () => ({ RendererIPCMessageBus: mocks.bus }));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (bus: unknown) => bus }));
vi.mock("@/common/hooks/use-user-track-manager", () => ({
  useUserTrackManager: () => ({ heartManager: undefined })
}));
vi.mock("@/common/hooks/use-heart", () => ({
  useHeart: () => ({ checkLiked: () => false, likedChange: vi.fn() })
}));
vi.mock("@/common/lib/window", () => ({ RendererWindow: {} }));
vi.mock("@/common/lib/format", () => ({
  RendererFormat: { quality: () => undefined, duration: () => "0:00" }
}));
vi.mock("@/common/netease/api", () => ({ NeteaseAPITrack: {} }));
vi.mock("@/common/netease/models", () => ({
  NeteaseTrack: {},
  NeteaseArtist: {},
  NeteaseNetworkImage: { fromTrackCover: () => undefined }
}));
vi.mock("@/common/components/display/marquee", () => ({ default: () => null }));
vi.mock("@/common/components/display/image/netease-image", () => ({ default: () => null }));

afterEach(cleanup);

it("shows every shared repeat mode and delivers the full off → one → all → off cycle", () => {
  mocks.bus.trackMeta.data.repeat = "off";
  const { rerender } = render(<RadioMeta />);
  const modes = [
    ["off", "循环关闭", "repeat-off", "one"],
    ["one", "单曲循环", "repeat-1", "all"],
    ["all", "列表循环", "repeat-2", "off"]
  ] as const;
  for (const [mode, label, icon, next] of modes) {
    mocks.bus.trackMeta.data.repeat = mode;
    rerender(<RadioMeta className={mode} />);
    const button = screen.getByRole("button", { name: label });
    expect(button).toHaveAttribute("aria-pressed", String(mode !== "off"));
    expect(button.querySelector(`.lucide-${icon}`)).not.toBeNull();
    fireEvent.click(button);
    expect(mocks.bus.playlistAction.deliver).toHaveBeenLastCalledWith({
      type: "repeatMode",
      value: next
    });
  }
});
