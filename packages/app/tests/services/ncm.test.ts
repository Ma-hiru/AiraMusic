import NeteaseMusicApiService from "@mahiru/app/services/ncm";

describe("test ncm server", () => {
  const port = 5000;
  let ncm: Awaited<ReturnType<typeof NeteaseMusicApiService.create>>;
  beforeAll(async () => {
    ncm = await NeteaseMusicApiService.create((err) => {
      console.error("ncm api server start error: ", err);
    }, port);
  });
  afterAll(async () => {
    try {
      ncm?.server?.close();
    } catch (err) {
      console.error("ncm api server close error: ", err);
    }
  });

  it("should not be failed and songs should be 50", async () => {
    const id = 6452;
    const response: any = await fetch(`http://localhost:${port}/artist/top/song?id=${id}`).then(
      (response) => response.json()
    );
    expect(response.code).toBe(200);
    expect(response.songs.length).toBe(50);
  });
});
