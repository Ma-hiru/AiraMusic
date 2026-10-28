export type WebContentReadyOptions = {
  images?: boolean;
  keyword?: string;
  selector?: string;
  engine?: "bing" | "baidu" | "duckduckgo";
};

/** 只读取有限文本样本；等待异步正文出现，避免每次探测都提取整页。 */
export function waitForWebContent(options: WebContentReadyOptions, timeoutMs: number) {
  return new Promise<{ ready: boolean }>((resolve) => {
    const started = performance.now();
    let previous = "";
    let stableSince = started;
    const finish = (ready: boolean) => resolve({ ready });
    const sample = () => {
      let root = options.selector
        ? document.querySelector(options.selector)
        : document.querySelector("article,main,[role=main]") || document.body;
      if (!root) return "";
      if (options.engine) {
        const selectors = {
          bing: "#b_results .b_algo h2 a",
          baidu: "#content_left .result h3 a,#content_left .c-container h3 a",
          duckduckgo: ".result .result__a"
        };
        root = document.querySelector(selectors[options.engine]);
        if (!root) return "";
      }
      if (options.images) {
        const image = root.querySelector("img[src],img[data-src]");
        return image?.getAttribute("src") || image?.getAttribute("data-src") || "";
      }
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
      );
      let text = "";
      let node: Node | null = root;
      for (let visited = 0; node && visited < 256 && text.length < 2_000; visited++) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).matches("script,style,noscript,nav,footer,svg,[hidden]")
        ) {
          // TreeWalker 的 nextSibling 会跳过当前节点的整个子树。
          while (node && node !== root && !walker.nextSibling()) node = walker.parentNode();
          if (!node || node === root) break;
          node = walker.currentNode;
          continue;
        }
        if (node.nodeType === Node.TEXT_NODE)
          text += (node.nodeValue || "").slice(0, 2_000 - text.length);
        node = walker.nextNode();
      }
      return text.replace(/\s+/g, " ").trim();
    };
    const check = () => {
      let current: string;
      try {
        current = sample();
      } catch {
        // 无效选择器由实际提取给出错误，不把它伪装为内容加载超时。
        finish(false);
        return;
      }
      const now = performance.now();
      if (current !== previous) {
        previous = current;
        stableSince = now;
      }
      const meaningful =
        current.length >= (options.engine || options.images ? 1 : 80) &&
        !/^(?:loading[.\s…]*|加载中[.\s…]*|正在加载[.\s…]*)$/i.test(current) &&
        (!options.keyword ||
          current.toLocaleLowerCase().includes(options.keyword.toLocaleLowerCase()));
      if (meaningful && (options.engine || now - stableSince >= 150)) finish(true);
      else if (now - started >= timeoutMs) finish(false);
      else setTimeout(check, Math.min(75, timeoutMs - (now - started)));
    };
    check();
  });
}

export function createWebContentReadyScript(options: WebContentReadyOptions, timeoutMs = 2_000) {
  return `/*aira-content-ready*/(${waitForWebContent.toString()})(${JSON.stringify(options)},${Math.max(0, timeoutMs)})`;
}
