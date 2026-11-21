import { Provider, createStore } from "jotai";
import { type PropsWithChildren } from "react";
import { useNavigate, MemoryRouter } from "react-router-dom";
import { act, cleanup, renderHook } from "@testing-library/react";
import { backgroundCoverAtom } from "@mahiru/ui/wins/main/atoms/theme";
import { useSetBackground } from "@mahiru/ui/wins/main/hooks/use-set-background";

vi.mock("@/wins/main/atoms/theme", async () => {
  const { atom } = await import("jotai");
  return { backgroundCoverAtom: atom<string | undefined>(undefined) };
});

afterEach(cleanup);

it("keeps a hidden page's cover for its next visit without changing the active theme", () => {
  const store = createStore();
  const Wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={["/album"]}>{children}</MemoryRouter>
    </Provider>
  );
  const { result } = renderHook(
    () => ({
      album: useSetBackground("album").setBackground,
      artist: useSetBackground("artist").setBackground,
      navigate: useNavigate()
    }),
    { wrapper: Wrapper }
  );

  const setAlbumCover = result.current.album;
  act(() => setAlbumCover("initial-album"));
  act(() => void result.current.navigate("/artist"));
  act(() => result.current.artist("artist-cover"));
  act(() => setAlbumCover("late-album"));
  expect(store.get(backgroundCoverAtom)).toBe("artist-cover");

  act(() => void result.current.navigate("/album"));
  expect(store.get(backgroundCoverAtom)).toBe("late-album");
});
