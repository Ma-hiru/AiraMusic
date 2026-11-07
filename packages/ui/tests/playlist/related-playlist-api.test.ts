import PlaylistAPI from "@mahiru/ui/common/netease/api/playlist";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/common/netease/api/request", () => ({ apiRequest }));

it("uses the playlist recommendation endpoint and forwards cancellation", () => {
  const controller = new AbortController();
  PlaylistAPI.relative(3186449132, controller.signal);

  expect(apiRequest).toHaveBeenCalledWith({
    url: "/playlist/detail/rcmd/get",
    params: { id: 3186449132 },
    signal: controller.signal
  });
});
