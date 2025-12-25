export function splitTrackTitle(title?: string) {
  const result = { main: title?.trim() || "", sub: "" };
  if (!title) return result;

  const regex = /^(.*?)\s*(\([^()]*\)|（[^（）]*）|\[[^[\]]*]|【[^【】]*】|-[^-\s][^-]*-)\s*$/;
  const match = title.match(regex);
  if (!match) return result;

  result.main = match[1]?.trim() || "";
  result.sub = match[2]?.trim() || "";
  if (result.sub === title.trim()) {
    result.main = title.trim();
    result.sub = "";
  }

  return result;
}
