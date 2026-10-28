import { WebBrowser } from "@mahiru/app/lib/web-search";
import { MainAgentTool } from "@mahiru/app/lib/agent/tool";
import { WebBrowserError } from "@mahiru/app/lib/web-browser-error";
import { AgentToolWebExecute, AgentToolWebSnapshot } from "@mahiru/app/inner/agent/tools/inner";

vi.mock("@mahiru/ipc/main", () => ({ MainIPC: { MessageChannel: {} } }));

vi.mock("@mahiru/app/lib/web-search", () => ({
  WebBrowser: {
    open: vi.fn().mockResolvedValue({
      pageId: "page-1",
      url: "https://example.com/",
      title: "Example",
      snapshot: "<body>Example</body>"
    }),
    navigate: vi.fn().mockResolvedValue(undefined),
    snapshot: vi.fn().mockResolvedValue({
      url: "https://example.com/",
      title: "Example",
      snapshot: "<body>Example</body>"
    }),
    execute_script: vi.fn().mockResolvedValue("Example"),
    read_page: vi.fn().mockResolvedValue({ content: "Example" }),
    read_section: vi.fn().mockResolvedValue({ content: "Example" }),
    get_images: vi.fn().mockResolvedValue({ images: [] }),
    search: vi.fn().mockResolvedValue({ results: [] })
  }
}));

describe("WebBrowser 工具", () => {
  beforeEach(() => vi.clearAllMocks());

  it("执行当前页面的 JavaScript 并返回结果，不重新导航", async () => {
    const tool = AgentToolWebExecute;
    const result = await tool.execute(
      tool.inputSchema.parse({ action: "execute_js", js: "document.title" })
    );
    expect(WebBrowser.execute_script).toHaveBeenCalledWith("document.title", undefined, undefined);
    expect(WebBrowser.navigate).not.toHaveBeenCalled();
    expect(WebBrowser.open).not.toHaveBeenCalled();
    expect(WebBrowser.snapshot).not.toHaveBeenCalled();
    expect(result).toBe("Example");
  });

  it("允许单独读取快照，同时保留仅传 URL 的调用", async () => {
    const tool = AgentToolWebSnapshot;
    await tool.execute(tool.inputSchema.parse({ action: "snapshot" }));
    expect(WebBrowser.navigate).not.toHaveBeenCalled();
    expect(WebBrowser.snapshot).toHaveBeenCalledOnce();
    await tool.execute(tool.inputSchema.parse({ url: "https://example.com/" }));
    expect(WebBrowser.open).toHaveBeenCalledExactlyOnceWith(
      "https://example.com/",
      undefined,
      undefined
    );
    expect(WebBrowser.navigate).not.toHaveBeenCalled();
    expect(WebBrowser.snapshot).toHaveBeenCalledOnce();
  });

  it.each([
    { action: "search", method: "search", input: { query: "AiraMusic" } },
    { action: "read_page", method: "read_page", input: { url: "https://example.com/" } },
    { action: "read_section", method: "read_section", input: { keyword: "Example" } },
    { action: "get_images", method: "get_images", input: {} },
    { action: "open", method: "open", input: { url: "https://example.com/" } },
    { action: "navigate", method: "navigate", input: { url: "https://example.com/" } },
    { action: "snapshot", method: "snapshot", input: {} },
    { action: "execute_js", method: "execute_script", input: { js: "document.title" } }
  ] as const)("$action 将请求取消信号传入浏览器", async ({ input, action, method }) => {
    const controller = new AbortController();
    const context = {
      signal: controller.signal,
      conversationID: "thread-1",
      outputDetail: "standard" as const
    };
    if (action === "execute_js")
      await AgentToolWebExecute.execute(AgentToolWebExecute.inputSchema.parse(input), context);
    else
      await AgentToolWebSnapshot.execute(
        AgentToolWebSnapshot.inputSchema.parse({ action, ...input }),
        context
      );
    const operation = vi.mocked(WebBrowser[method]);
    expect(operation).toHaveBeenCalledOnce();
    expect(operation.mock.calls[0]!.at(-1)).toBe(controller.signal);
  });

  it("浏览器收到取消后将 AbortError 映射为 aborted 工具错误", async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    vi.mocked(WebBrowser.read_page).mockImplementationOnce(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal!.addEventListener(
            "abort",
            () => reject(new DOMException("网页读取已取消", "AbortError")),
            { once: true }
          );
          started.resolve();
        })
    );
    const tool = AgentToolWebSnapshot;
    const pending = tool.execute(
      tool.inputSchema.parse({ action: "read_page", url: "https://example.com/" }),
      {
        signal: controller.signal,
        conversationID: "thread-1",
        outputDetail: "standard"
      }
    );
    const assertion = expect(pending).rejects.toMatchObject({
      code: "aborted",
      message: "网页读取已取消"
    });
    await started.promise;
    controller.abort();
    await assertion;
  });

  it.each([
    ["forbidden", false],
    ["page_expired", false],
    ["cache_expired", false],
    ["script_error", false],
    ["timeout", true],
    ["busy", true]
  ] as const)("读取错误保留 %s 分类与重试语义", async (code, retryable) => {
    vi.mocked(WebBrowser.read_page).mockRejectedValueOnce(new WebBrowserError(code, "failure"));
    const tool = AgentToolWebSnapshot;
    const error = await tool
      .execute(tool.inputSchema.parse({ action: "read_page" }))
      .catch((error) => error);
    expect(MainAgentTool.formatError(error, tool).structuredContent).toMatchObject({
      error: { code, retryable }
    });
  });

  it("脚本抛错或超时后不建议自动重试，避免重复提交副作用", async () => {
    const tool = AgentToolWebExecute;
    for (const code of ["script_error", "timeout"] as const) {
      vi.mocked(WebBrowser.execute_script).mockRejectedValueOnce(
        new WebBrowserError(code, "failure")
      );
      const error = await tool
        .execute(tool.inputSchema.parse({ js: "submit()" }))
        .catch((error) => error);
      expect(MainAgentTool.formatError(error, tool).structuredContent).toMatchObject({
        error: { code: "commit_unknown", retryable: false }
      });
    }
  });

  it("校验每种操作所需参数", () => {
    const tool = AgentToolWebSnapshot;
    expect(tool.inputSchema.safeParse({ action: "execute_js", js: "document.title" }).success).toBe(
      false
    );
    expect(AgentToolWebExecute.inputSchema.safeParse({}).success).toBe(false);
    expect(tool.inputSchema.safeParse({ action: "navigate" }).success).toBe(false);
    expect(
      tool.inputSchema.safeParse({ action: "navigate", url: "file:///tmp/test" }).success
    ).toBe(false);
  });
});
