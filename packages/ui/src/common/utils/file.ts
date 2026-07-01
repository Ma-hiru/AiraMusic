export function getImageExtension(contentType: Optional<string>) {
  // eg: Content-Type: text/html; charset=utf-8
  if (!contentType) return "";
  const mime = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mime?.startsWith("image/")) return "";

  const ext = mime.replace("image/", "");
  if (ext === "jpeg") return "jpg";
  if (ext === "svg+xml") return "svg";
  return ext || "";
}

export function getURLFileName(url: Optional<string>) {
  if (!url) return "";
  try {
    const path = new URL(url, window.location.href).pathname;
    return decodeURIComponent(path.split("/").filter(Boolean).at(-1) || "");
  } catch {
    return url.split("/").filter(Boolean).at(-1) || "";
  }
}

export function getExtension(fileName: string) {
  const ext = fileName.split(".").at(-1);
  if (!ext || ext === fileName) return "";
  return ext;
}

export function resolveFilename(fileName: string, ext: string) {
  fileName = replaceUnsafeChars(stripControlChars(fileName.trim().replaceAll(" ", "_")), "_").slice(
    0,
    120
  );
  ext = replaceUnsafeChars(stripControlChars(ext.trim()), "").slice(0, 10);

  const normalizedExt = ext.replace(/^\./, "");
  if (!normalizedExt) return fileName;
  if (fileName.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) return fileName;
  return `${fileName}.${normalizedExt}`;
}

function stripControlChars(value: string) {
  return [...value].filter((char) => char.charCodeAt(0) >= 32).join("");
}

function replaceUnsafeChars(value: string, replacement = "_") {
  return value.replace(/[<>:"/\\|?*]/g, replacement);
}
