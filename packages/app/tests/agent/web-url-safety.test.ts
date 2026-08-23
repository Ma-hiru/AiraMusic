import {
  assertPublicWebURL,
  type WebHostLookup,
  isBlockedWebAddress,
  isPublicWebHostname,
  canRequestPublicWebURL,
  resolvePublicWebHostname
} from "@mahiru/app/inner/mcp/tools/web-url-safety";

describe("agent web URL safety", () => {
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
    await expect(
      canRequestPublicWebURL("https://redirect.example/next", privateLookup)
    ).resolves.toBe(false);
  });

  it.each(["file:///etc/passwd", "http://user:pass@example.com", "http://localhost/"])(
    "rejects unsafe URL form %s",
    async (url) => {
      await expect(canRequestPublicWebURL(url)).resolves.toBe(false);
    }
  );
});
