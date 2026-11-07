vi.mock("@mahiru/ui/common/netease/api", () => ({
  NeteaseAPIUser: {
    likedAlbums: vi.fn(),
    likedArtists: vi.fn()
  }
}));

const account = vi.hoisted(() => ({ userID: 1 }));

vi.mock("@/common/store/user", () => ({
  userStoreSnapshot: () => ({ _user: { userId: account.userID } })
}));

import { NeteaseAPIUser } from "@mahiru/ui/common/netease/api";
import { NeteaseStarAlbum } from "@mahiru/ui/common/netease/models";
import { NeteaseServicesStar } from "@mahiru/ui/common/netease/services";

const albumResponse = {
  code: 200,
  count: 1,
  hasMore: false,
  data: [
    {
      id: 1,
      name: "Cached Album",
      picUrl: "https://example.com/album.jpg",
      size: 10,
      subTime: 1,
      artists: [{ id: 2, name: "Artist", alias: [] }]
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(NeteaseAPIUser.likedAlbums).mockReset();
  vi.mocked(NeteaseAPIUser.likedArtists).mockReset();
  account.userID = 1;
  NeteaseServicesStar.invalidateAlbums();
  NeteaseServicesStar.invalidateArtists();
});

it("caches album pages, returns models and supports cache bypass", async () => {
  const likedAlbums = vi.mocked(NeteaseAPIUser.likedAlbums);
  likedAlbums.mockResolvedValue(albumResponse);

  const first = await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  expect(first.items[0]).toBeInstanceOf(NeteaseStarAlbum);
  expect(first.items[0]?.name).toBe("Cached Album");
  expect(likedAlbums).toHaveBeenCalledTimes(1);

  const cached = await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  expect(cached).toBe(first);
  expect(likedAlbums).toHaveBeenCalledTimes(1);

  await NeteaseServicesStar.albums({ limit: 30, offset: 0 }, undefined, false);
  expect(likedAlbums).toHaveBeenCalledTimes(2);
});

it("normalizes a missing total to the loaded item count", async () => {
  const likedAlbums = vi.mocked(NeteaseAPIUser.likedAlbums);
  likedAlbums.mockResolvedValue({ ...albumResponse, count: 0 });

  const page = await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  expect(page.count).toBe(1);
});

it("invalidates the album cache by generation", async () => {
  const likedAlbums = vi.mocked(NeteaseAPIUser.likedAlbums);
  likedAlbums.mockResolvedValue(albumResponse);

  await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  expect(likedAlbums).toHaveBeenCalledTimes(1);

  NeteaseServicesStar.invalidateAlbums();
  await NeteaseServicesStar.albums({ limit: 30, offset: 0 });
  expect(likedAlbums).toHaveBeenCalledTimes(2);
});

function accountResponse(name: string) {
  return {
    ...albumResponse,
    data: [
      {
        ...albumResponse.data[0]!,
        name,
        alias: [],
        albumSize: 4,
        mvSize: 2,
        fansCount: 100,
        followed: true
      }
    ]
  };
}

it.each(["albums", "artists"] as const)(
  "keeps %s caches separate between accounts",
  async (kind) => {
    const request = vi.mocked(
      kind === "albums" ? NeteaseAPIUser.likedAlbums : NeteaseAPIUser.likedArtists
    );
    request
      .mockResolvedValueOnce(accountResponse("Account A"))
      .mockResolvedValueOnce(accountResponse("Account B"));
    const load = () => NeteaseServicesStar[kind]({ limit: 30 });

    const first = await load();
    account.userID = 2;
    const second = await load();

    expect(first.items[0]?.name).toBe("Account A");
    expect(second.items[0]?.name).toBe("Account B");
    expect(request).toHaveBeenCalledTimes(2);
    expect(await load()).toBe(second);

    account.userID = 1;
    expect(await load()).toBe(first);
    expect(request).toHaveBeenCalledTimes(2);
  }
);

it.each(["albums", "artists"] as const)(
  "keeps a late account A %s response out of account B's cache",
  async (kind) => {
    let resolve!: (value: ReturnType<typeof accountResponse>) => void;
    const pending = new Promise<ReturnType<typeof accountResponse>>((done) => (resolve = done));
    const request = vi.mocked(
      kind === "albums" ? NeteaseAPIUser.likedAlbums : NeteaseAPIUser.likedArtists
    );
    request.mockReturnValueOnce(pending).mockResolvedValueOnce(accountResponse("Account B"));
    const load = () => NeteaseServicesStar[kind]({ limit: 30 });

    const firstRequest = load();
    account.userID = 2;
    const second = await load();
    resolve(accountResponse("Account A"));
    const first = await firstRequest;

    expect((await load()).items[0]?.name).toBe("Account B");
    expect(await load()).toBe(second);
    account.userID = 1;
    expect(await load()).toBe(first);
    expect(request).toHaveBeenCalledTimes(2);
  }
);
