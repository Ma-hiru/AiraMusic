import {
  assertPublicWebURL,
  type WebHostLookup,
  isBlockedWebAddress,
  isPublicWebHostname,
  canRequestPublicWebURL,
  resolvePublicWebHostname
} from "@mahiru/app/lib/web-url-safety";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  networkInterfaces: vi.fn()
}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:os", () => ({ networkInterfaces: mocks.networkInterfaces }));

describe("agent web URL safety", () => {
  beforeEach(() => {
    mocks.lookup.mockReset().mockResolvedValue([{ family: 4, address: "93.184.216.34" }]);
    mocks.networkInterfaces.mockReset().mockReturnValue({});
  });
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255"
  ])("blocks private or reserved IPv4 %s", (address) => {
    expect(isBlockedWebAddress(address)).toBe(true);
  });

  it.each([
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:8.8.8.8",
    "64:ff9b::7f00:1",
    "2001:db8::1",
    "2002:7f00:1::",
    "fc00::1",
    "fe80::1",
    "ff02::1"
  ])("blocks private, mapped, transition, or reserved IPv6 %s", (address) => {
    expect(isBlockedWebAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "allows globally routable address %s",
    (address) => {
      expect(isBlockedWebAddress(address)).toBe(false);
    }
  );

  it("fails closed for DNS errors and empty answers", async () => {
    const rejects: WebHostLookup = async () => {
      throw new Error("dns unavailable");
    };
    const empty: WebHostLookup = async () => [];

    await expect(isPublicWebHostname("example.com", rejects)).resolves.toBe(false);
    await expect(isPublicWebHostname("example.com", empty)).resolves.toBe(false);
  });

  it("rejects a hostname when any DNS answer is private", async () => {
    const mixed: WebHostLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ];
    await expect(isPublicWebHostname("example.com", mixed)).resolves.toBe(false);
    await expect(resolvePublicWebHostname("example.com", mixed)).resolves.toEqual([]);
  });

  it("returns the exact validated endpoint that a transport can pin", async () => {
    const publicLookup: WebHostLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ];

    await expect(resolvePublicWebHostname("example.com", publicLookup)).resolves.toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ]);
  });

  it("revalidates redirect targets with the same fail-closed policy", async () => {
    const publicLookup: WebHostLookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const privateLookup: WebHostLookup = async () => [{ address: "10.0.0.8", family: 4 }];

    await expect(
      assertPublicWebURL("https://example.com/start", publicLookup)
    ).resolves.toBeInstanceOf(URL);
    mocks.lookup.mockImplementation(privateLookup);
    await expect(canRequestPublicWebURL("https://redirect.example/next")).resolves.toBe(false);
  });

  it.each([
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "http://localhost/",
    "http://0x7f000001/",
    "http://2130706433/"
  ])("rejects unsafe URL form %s", async (url) => {
    await expect(canRequestPublicWebURL(url)).resolves.toBe(false);
  });
});

describe("本机地址和请求协议", () => {
  beforeEach(() => {
    mocks.lookup.mockReset().mockResolvedValue([{ family: 4, address: "93.184.216.34" }]);
    mocks.networkInterfaces.mockReset().mockReturnValue({
      en0: [
        { address: "8.8.4.4", family: "IPv4" },
        { address: "2606:4700:4700::1234", family: "IPv6" }
      ]
    });
  });

  it.each(["8.8.4.4", "2606:4700:4700:0:0:0:1234"])(
    "拒绝本机网卡绑定的公网地址 %s",
    async (address) => {
      expect(isBlockedWebAddress(address)).toBe(true);
      mocks.lookup.mockResolvedValue([{ family: address.includes(":") ? 6 : 4, address }]);
      await expect(assertPublicWebURL("https://self.example/")).rejects.toThrow("不允许访问");
    }
  );

  it("每次读取当前网卡地址而不是缓存启动时快照", async () => {
    await expect(assertPublicWebURL("https://93.184.216.34/")).resolves.toBeInstanceOf(URL);
    mocks.networkInterfaces.mockReturnValue({ en0: [{ address: "93.184.216.34" }] });
    await expect(assertPublicWebURL("https://93.184.216.34/")).rejects.toThrow("不允许访问");
  });

  it("DNS 的任一结果为本机公网地址时拒绝整个目标", async () => {
    mocks.lookup.mockResolvedValue([
      { family: 4, address: "93.184.216.34" },
      { family: 4, address: "8.8.4.4" }
    ]);
    await expect(canRequestPublicWebURL("https://self.example/")).resolves.toBe(false);
    expect(mocks.lookup).toHaveBeenCalledWith("self.example", { all: true, verbatim: true });
  });

  it("只有显式允许时才能加载精确的 about:blank", async () => {
    await expect(canRequestPublicWebURL("about:blank")).resolves.toBe(false);
    await expect(canRequestPublicWebURL("about:blank", { allowAboutBlank: true })).resolves.toBe(
      true
    );
    for (const url of [
      "about:blank#x",
      "data:text/html,hello",
      "file:///tmp/test",
      "ws://example.com/"
    ])
      await expect(canRequestPublicWebURL(url, { allowAboutBlank: true })).resolves.toBe(false);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("DNS 返回无效 IP 或地址族不符时拒绝目标", async () => {
    for (const result of [
      { family: 4, address: "::1" },
      { family: 6, address: "invalid" }
    ]) {
      mocks.lookup.mockResolvedValue([result]);
      await expect(canRequestPublicWebURL("https://example.com/")).resolves.toBe(false);
    }
  });
});
