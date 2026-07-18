import { parseAiraResourceURI } from "@mahiru/ai";

type MarkdownNode = {
  url?: string;
  type?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
};

function transformResourceLinks(node: MarkdownNode) {
  if (node.type === "link" && typeof node.url === "string") {
    const resource = parseAiraResourceURI(node.url);
    if (resource) {
      node.data = {
        ...node.data,
        hName: "aira-resource",
        hProperties: {
          kind: resource.kind,
          resourceid: String(resource.id)
        }
      };
    }
  }

  for (const child of node.children ?? []) transformResourceLinks(child);
}

/**
 * 在 Markdown 已完成语法解析后转换应用资源链接，因此代码块、转义文本和 HTML
 * 原样保留，不会被误识别成可执行的应用动作。
 */
export function remarkAiraResourceLinks() {
  return (tree: MarkdownNode) => transformResourceLinks(tree);
}
