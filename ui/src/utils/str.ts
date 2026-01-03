import { commonEmojiMap } from "@mahiru/ui/constants/emoji";

export function splitTrackTitle(title?: string) {
  const result = { main: title?.trim() || "", sub: "" };
  if (!title) return result;

  const regex = /^(.*?)\s*(\([^()]*\)|（[^（）]*）|\[[^[\]]*]|【[^【】]*】|-[^-\s][^-]*-)\s*$/;
  const match = title.match(regex);
  if (!match) return result;

  result.main = match[1]?.trim() || "";
  result.sub =
    match[2]
      ?.trim()
      .replace(/^[（([【-]\s*/, "")
      .replace(/[）)\]】-]\s*$/, "") || "";

  if (result.sub === title.trim()) {
    result.main = title.trim();
    result.sub = "";
  }

  return result;
}

export function parseCommentEmoji(text: string): string {
  if (!text || !text.includes("[")) return text;

  return text.replace(/\[([^[\]]+)]/g, (raw, name) => {
    return commonEmojiMap[name] ?? raw;
  });
}
