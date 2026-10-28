// @ts-expect-error 根目录测试依赖未附带 jsdom 的类型声明。
import { JSDOM } from "jsdom";
import { createWebContentReadyScript } from "@mahiru/app/lib/web-page-ready";

function page(html: string) {
  return new JSDOM(html, { url: "https://example.com/", runScripts: "outside-only" });
}

describe("网页内容就绪检测", () => {
  it("等待异步正文出现，不把 dom-ready 后的标题和占位符当成正文", async () => {
    const dom = page("<main><h1>文章</h1><p>Loading...</p></main>");
    try {
      const pending = dom.window.eval(createWebContentReadyScript({}, 500));
      dom.window.setTimeout(() => {
        dom.window.document.querySelector("p")!.textContent = "真正异步加载的文章正文。".repeat(20);
      }, 30);
      expect(await pending).toEqual({ ready: true });
    } finally {
      dom.window.close();
    }
  });

  it.each([
    [
      "bing",
      '<div id="b_results"><div class="b_algo"><h2><a href="/result">结果</a></h2></div></div>'
    ],
    [
      "baidu",
      '<div id="content_left"><div class="result"><h3><a href="/result">结果</a></h3></div></div>'
    ],
    ["duckduckgo", '<div class="result"><a class="result__a" href="/result">结果</a></div>']
  ] as const)("%s 等待结果节点，已有导航文字不能提前结束", async (engine, html) => {
    const dom = page("<body><nav>搜索导航</nav></body>");
    try {
      const pending = dom.window.eval(createWebContentReadyScript({ engine }, 300));
      dom.window.setTimeout(
        () => dom.window.document.body.insertAdjacentHTML("beforeend", html),
        20
      );
      expect(await pending).toEqual({ ready: true });
    } finally {
      dom.window.close();
    }
  });

  it("超时返回未就绪，短文仍可由后续提取读取", async () => {
    const dom = page("<main>短文</main>");
    try {
      expect(await dom.window.eval(createWebContentReadyScript({}, 30))).toEqual({ ready: false });
    } finally {
      dom.window.close();
    }
  });

  it("探针不克隆正文、不读取整树 textContent，忽略脚本噪声", async () => {
    const dom = page(
      `<body><script>${"noise".repeat(50_000)}</script><main><p>${"正文内容".repeat(30)}</p></main></body>`
    );
    const clone = vi.spyOn(dom.window.Node.prototype, "cloneNode");
    const text = vi
      .spyOn(dom.window.Node.prototype, "textContent", "get")
      .mockImplementation(() => {
        throw new Error("不应读取整树正文");
      });
    try {
      expect(await dom.window.eval(createWebContentReadyScript({}, 400))).toEqual({ ready: true });
      expect(clone).not.toHaveBeenCalled();
      expect(text).not.toHaveBeenCalled();
    } finally {
      dom.window.close();
    }
  });

  it("指定区域尚未出现时等待，非法 selector 交给实际提取报错", async () => {
    const dom = page("<main></main>");
    try {
      expect(
        await dom.window.eval(createWebContentReadyScript({ selector: ".missing" }, 10))
      ).toEqual({ ready: false });
      expect(await dom.window.eval(createWebContentReadyScript({ selector: "[" }, 100))).toEqual({
        ready: false
      });
    } finally {
      dom.window.close();
    }
  });
});
