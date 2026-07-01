import { NeteaseURL } from "@mahiru/ui/common/netease/models";

import { NeteaseImageSize } from "../../src/common/enum";

describe("NeteaseURL image sizing", () => {
  it("removes existing NetEase image operation query before adding a thumbnail size", () => {
    const source =
      "http://p1.music.126.net/HnYEb2ilgQarW4b31YY5SQ==/109951171991108161.jpg?imageView=1&thumbnail=800y800&enlarge=1%7CimageView%3D1&watermark=&image=b2JqL3dvbkRsc0tVd3JMQ2xHakNtOEt4LzI3NjEwNDk3MDYyLnBuZw%3D%3D&dx=0&dy=0%7CimageView%3D1&thumbnail=140y140";

    const sized = NeteaseURL.setImageSize(source, 180);
    const url = new URL(sized);

    expect(url.origin + url.pathname).toBe(
      "http://p1.music.126.net/HnYEb2ilgQarW4b31YY5SQ==/109951171991108161.jpg"
    );
    expect(url.searchParams.get("param")).toBe("180y180");
    expect(url.searchParams.get("type")).toBe("webp");
    expect(url.searchParams.has("imageView")).toBe(false);
    expect(url.searchParams.has("watermark")).toBe(false);
  });

  it("strips NetEase image operation query for raw images", () => {
    const source =
      "http://p4.music.126.net/JzNK4a5PjjPIXAgVlqEc5Q==/109951164154280311.jpg?param=200y200&type=webp";

    expect(NeteaseURL.setImageSize(source, NeteaseImageSize.raw)).toBe(
      "http://p4.music.126.net/JzNK4a5PjjPIXAgVlqEc5Q==/109951164154280311.jpg"
    );
  });

  it("keeps existing query on non-NetEase images", () => {
    const source = "https://example.com/image.jpg?token=abc";

    const sized = NeteaseURL.setImageSize(source, 100);
    const url = new URL(sized);

    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("param")).toBe("100y100");
    expect(url.searchParams.get("type")).toBe("webp");
  });
});
