const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);

export type SnapshotNode = {
  id?: string;
  tag: string;
  alt?: string;
  src?: string;
  href?: string;
  children: (string | SnapshotNode)[];
};

export const escapeHTML = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

export const serializeHTMLSnapshotNode = (node: null | string | SnapshotNode): string => {
  if (node === null) return "";
  if (typeof node === "string") return escapeHTML(node);
  const attrs: string[] = [];
  if (node.id) attrs.push(`id="${escapeHTML(node.id)}"`);
  if (node.href) attrs.push(`href="${escapeHTML(node.href)}"`);
  if (node.src) attrs.push(`src="${escapeHTML(node.src)}"`);
  if (node.alt) attrs.push(`alt="${escapeHTML(node.alt)}"`);
  const open = `<${node.tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  if (VOID_TAGS.has(node.tag)) return open;
  return `${open}${node.children.map(serializeHTMLSnapshotNode).join("")}</${node.tag}>`;
};
