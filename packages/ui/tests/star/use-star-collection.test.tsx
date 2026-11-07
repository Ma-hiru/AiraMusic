import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import { useStarCollection } from "@mahiru/ui/common/hooks/use-star-collection";

type Item = { id: number };
type Page = { count: number; items: Item[]; hasMore: boolean };

afterEach(cleanup);

function createFetch() {
  return vi.fn(
    async (offset: number): Promise<{ count: number; items: Item[]; hasMore: boolean }> => {
      if (offset === 0) {
        return { items: [{ id: 1 }, { id: 2 }], count: 4, hasMore: true };
      }
      return { items: [{ id: 2 }, { id: 3 }, { id: 4 }], count: 4, hasMore: false };
    }
  );
}

it("loads the first page, appends without duplicates and exposes hasMore", async () => {
  const fetchPage = createFetch();
  const { result } = renderHook(() =>
    useStarCollection({
      fetchPage,
      getId: (item: Item) => item.id,
      pageSize: 2
    })
  );

  await waitFor(() => expect(result.current.status).toBe("success"));
  expect(result.current.data.map((item) => item.id)).toEqual([1, 2]);
  expect(result.current.count).toBe(4);
  expect(result.current.hasMore).toBe(true);
  expect(fetchPage).toHaveBeenCalledWith(0, 2, expect.any(AbortSignal), false);

  act(() => result.current.loadMore());

  await waitFor(() => expect(result.current.data).toHaveLength(4));
  expect(result.current.data.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  expect(result.current.hasMore).toBe(false);
  expect(fetchPage).toHaveBeenLastCalledWith(2, 2, expect.any(AbortSignal), false);
});

it("reloads from the first page while bypassing the service cache", async () => {
  const fetchPage = createFetch();
  const { result } = renderHook(() =>
    useStarCollection({
      fetchPage,
      getId: (item: Item) => item.id,
      pageSize: 2
    })
  );

  await waitFor(() => expect(result.current.status).toBe("success"));

  act(() => result.current.reload());

  await waitFor(() =>
    expect(fetchPage).toHaveBeenLastCalledWith(0, 2, expect.any(AbortSignal), true)
  );
});

it("removes an item locally and decrements the count", async () => {
  const fetchPage = createFetch();
  const { result } = renderHook(() =>
    useStarCollection({
      fetchPage,
      getId: (item: Item) => item.id,
      pageSize: 2
    })
  );

  await waitFor(() => expect(result.current.status).toBe("success"));

  act(() => result.current.remove(1));

  expect(result.current.data.map((item) => item.id)).toEqual([2]);
  expect(result.current.count).toBe(3);
});

it("reloads from the first page when the refresh token changes", async () => {
  const fetchPage = createFetch();
  const { rerender } = renderHook(
    ({ token }: { token: number }) =>
      useStarCollection({
        fetchPage,
        getId: (item: Item) => item.id,
        pageSize: 2,
        refreshToken: token
      }),
    { initialProps: { token: 0 } }
  );

  await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

  rerender({ token: 1 });

  await waitFor(() =>
    expect(fetchPage).toHaveBeenLastCalledWith(0, 2, expect.any(AbortSignal), true)
  );
});

it("aborts the in-flight request on unmount", async () => {
  let captured: Optional<AbortSignal>;
  const fetchPage = vi.fn((_offset: number, _limit: number, signal: AbortSignal) => {
    captured = signal;
    return new Promise<never>(() => {});
  });

  const { unmount } = renderHook(() =>
    useStarCollection({
      fetchPage,
      getId: (item: Item) => item.id
    })
  );

  await waitFor(() => expect(captured).toBeDefined());
  unmount();
  expect(captured?.aborted).toBe(true);
});

function createCollection(ids: number[]) {
  const source = {
    items: ids.map((id) => ({ id })),
    page(offset: number, limit: number): Page {
      return {
        count: source.items.length,
        items: source.items.slice(offset, offset + limit),
        hasMore: offset + limit < source.items.length
      };
    }
  };
  const fetchPage = vi.fn<
    (offset: number, limit: number, signal: AbortSignal, bypassCache: boolean) => Promise<Page>
  >(async (offset, limit) => source.page(offset, limit));
  return { source, fetchPage };
}

it.each([{ removed: [1] }, { removed: [1, 2] }])(
  "continues through every remaining item after removing $removed from a loaded page",
  async ({ removed }) => {
    const { source, fetchPage } = createCollection([1, 2, 3, 4, 5, 6, 7, 8]);
    const { result } = renderHook(() =>
      useStarCollection({ fetchPage, getId: (item: Item) => item.id, pageSize: 3 })
    );
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => {
      source.items = source.items.filter((item) => !removed.includes(item.id));
      removed.forEach((id) => result.current.remove(id));
    });
    expect(result.current.data.map((item) => item.id)).toEqual(
      [1, 2, 3].filter((id) => !removed.includes(id))
    );

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchPage).toHaveBeenLastCalledWith(
      3 - removed.length,
      3,
      expect.any(AbortSignal),
      false
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    expect(result.current.data).toEqual(source.items);
    expect(result.current.count).toBe(source.items.length);
    expect(result.current.page).toBe(3);
  }
);

it("discards an in-flight page after removal and resumes from the corrected position", async () => {
  const { source, fetchPage } = createCollection([1, 2, 3, 4, 5, 6]);
  const { result } = renderHook(() =>
    useStarCollection({ fetchPage, getId: (item: Item) => item.id, pageSize: 2 })
  );
  await waitFor(() => expect(result.current.status).toBe("success"));

  let resolve!: (value: Page) => void;
  const pending = new Promise<Page>((done) => (resolve = done));
  const oldPage = source.page(2, 2);
  fetchPage.mockReturnValueOnce(pending);
  act(() => result.current.loadMore());
  const signal = fetchPage.mock.calls[1]![2];
  expect(result.current.status).toBe("loading");

  act(() => {
    source.items = source.items.filter((item) => item.id !== 1);
    result.current.remove(1);
  });
  expect(signal.aborted).toBe(true);
  expect(result.current.status).toBe("success");

  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.data.map((item) => item.id)).toEqual([2, 3, 4]));
  expect(fetchPage).toHaveBeenLastCalledWith(1, 2, expect.any(AbortSignal), false);
  await act(async () => resolve(oldPage));
  expect(result.current.data.map((item) => item.id)).toEqual([2, 3, 4]);
  expect(result.current.count).toBe(5);
  expect(result.current.status).toBe("success");

  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.hasMore).toBe(false));
  expect(result.current.data).toEqual(source.items);
  expect(result.current.page).toBe(3);
});
