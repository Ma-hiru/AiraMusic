import { act, render, cleanup, fireEvent } from "@testing-library/react";
import { NeteaseNetworkImage } from "@mahiru/ui/common/netease/models";
import NeteaseImage from "@mahiru/ui/common/components/display/image/netease-image";

const mocks = vi.hoisted(() => ({ local: vi.fn() }));

vi.mock("@/common/netease/services", () => ({
  NeteaseServicesImage: { local: mocks.local }
}));
vi.mock("@/common/lib/cache", () => ({
  RendererCache: { browser: { getOne: vi.fn() } }
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.local.mockReset();
});

it("keeps the current cover when the previous cache request finishes late", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  const first = Promise.withResolvers<null>();
  const second = Promise.withResolvers<null>();
  mocks.local.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  const oldCover = NeteaseNetworkImage.fromURL("https://example.test/old-cover.jpg");
  const newCover = NeteaseNetworkImage.fromURL("https://example.test/new-cover.jpg");
  const onLoad = vi.fn();
  const view = render(
    <NeteaseImage alt="cover" image={oldCover} cacheLazy={false} onLoad={onLoad} cache />
  );
  view.rerender(
    <NeteaseImage alt="cover" image={newCover} cacheLazy={false} onLoad={onLoad} cache />
  );

  await act(async () => {
    second.resolve(null);
    await second.promise;
  });
  await act(async () => {
    first.resolve(null);
    await first.promise;
  });
  const image = view.getByRole("img", { name: "cover" });
  expect(image).toHaveAttribute("src", newCover.src);
  fireEvent.load(image);
  expect(onLoad).toHaveBeenCalledOnce();
});
