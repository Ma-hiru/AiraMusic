import {
  type LLMMessage,
  parseAiraResourceURI,
  parseAiraRichContent,
  type AiraResourceCard,
  type AiraResourceKind
} from "@mahiru/ai";

type ToolCallEvidence = {
  name: string;
  arguments: unknown;
};

const PrimaryResourceKinds: Record<string, AiraResourceKind> = {
  "agent-search": "track",
  "agent-tool-album-detail": "album",
  "agent-tool-album-new": "album",
  "agent-tool-artist-albums": "album",
  "agent-tool-artist-detail": "artist",
  "agent-tool-artist-hot-tracks": "track",
  "agent-tool-artist-similar": "artist",
  "agent-tool-artist-toplist": "artist",
  "agent-tool-player-current": "track",
  "agent-tool-player-queue": "track",
  "agent-tool-playlist-detail": "playlist",
  "agent-tool-playlist-recommend": "playlist",
  "agent-tool-playlist-similar": "playlist",
  "agent-tool-playlist-top": "playlist",
  "agent-tool-track-detail": "track",
  "agent-tool-track-fm": "track",
  "agent-tool-track-recommend-daily": "track",
  "agent-tool-track-recommend-new": "track",
  "agent-tool-track-similar": "track",
  "agent-tool-user-play-history": "track",
  "agent-tool-user-playlists": "playlist"
};

const InputResourceKinds: Record<string, AiraResourceKind> = {
  "agent-tool-album-detail": "album",
  "agent-tool-album-star": "album",
  "agent-tool-artist-detail": "artist",
  "agent-tool-artist-desc": "artist",
  "agent-tool-playlist-detail": "playlist",
  "agent-tool-playlist-modify": "playlist",
  "agent-tool-playlist-star": "playlist",
  "agent-tool-track-comment": "track",
  "agent-tool-track-detail": "track",
  "agent-tool-track-like": "track",
  "agent-tool-track-lyrics": "track",
  "agent-tool-track-play": "track",
  "agent-tool-track-playable": "track",
  "agent-tool-track-similar": "track"
};

const SemanticResourceKeys: Record<string, AiraResourceKind> = {
  album: "album",
  albums: "album",
  artist: "artist",
  artists: "artist",
  hotTracks: "track",
  playlist: "playlist",
  playlists: "playlist",
  record: "track",
  records: "track",
  songs: "track",
  track: "track",
  tracks: "track"
};

const ResourceURIExpression = /aira:\/\/(track|album|playlist|artist)\/([1-9]\d*)/g;
const MarkdownResourceLinkExpression =
  /\[([^\]\n]{1,512})\]\((aira:\/\/(?:track|album|playlist|artist)\/[1-9]\d*)\)/g;

function parseJSON(value: string): unknown {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resourceKey(kind: AiraResourceKind, id: number) {
  return `${kind}:${id}`;
}

function addID(allowed: Set<string>, kind: AiraResourceKind, value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return;
  allowed.add(resourceKey(kind, value));
}

function collectTypedResources(
  value: unknown,
  kind: AiraResourceKind,
  allowed: Set<string>,
  depth = 0
) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) collectTypedResources(item, kind, allowed, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  addID(allowed, kind, value["id"]);
  for (const [key, child] of Object.entries(value)) {
    const semanticKind = SemanticResourceKeys[key];
    if (semanticKind) {
      collectTypedResources(child, semanticKind, allowed, depth + 1);
    } else if (key === "data" || key === "items" || key === "result" || key === "results") {
      collectTypedResources(child, kind, allowed, depth + 1);
    }
  }
}

function readToolEvidence(messages: readonly LLMMessage[]) {
  const calls = new Map<string, ToolCallEvidence>();
  const allowed = new Set<string>();

  for (const message of messages) {
    if (message.role === "assistant" && "toolCalls" in message) {
      for (const call of message.toolCalls) {
        calls.set(call.callID, { name: call.name, arguments: parseJSON(call.arguments) });
      }
      continue;
    }
    if (message.role !== "tool") continue;

    const output = parseJSON(message.content);
    if (isRecord(output) && isRecord(output["error"])) continue;
    const call = calls.get(message.callID);
    const name = call?.name ?? message.name;
    let primaryKind = PrimaryResourceKinds[name];
    if (name === "agent-search" && isRecord(call?.arguments)) {
      const requestedKind = call.arguments["type"];
      if (
        requestedKind === "track" ||
        requestedKind === "album" ||
        requestedKind === "playlist" ||
        requestedKind === "artist"
      ) {
        primaryKind = requestedKind;
      }
    }
    if (primaryKind) collectTypedResources(output, primaryKind, allowed);

    let inputKind = InputResourceKinds[name];
    if (name === "agent-tool-track-comment" && isRecord(call?.arguments)) {
      const requestedKind = call.arguments["type"];
      if (requestedKind === "track" || requestedKind === "album" || requestedKind === "playlist") {
        inputKind = requestedKind;
      }
    }
    if (inputKind && isRecord(call?.arguments)) {
      addID(allowed, inputKind, call.arguments["id"]);
    }
  }

  return allowed;
}

function sanitizeMarkdown(content: string, allowed: Set<string>) {
  const withoutUntrustedLinks = content.replace(
    MarkdownResourceLinkExpression,
    (full, label: string, uri: string) => {
      const resource = parseAiraResourceURI(uri);
      return resource && allowed.has(resourceKey(resource.kind, resource.id)) ? full : label;
    }
  );
  return withoutUntrustedLinks.replace(ResourceURIExpression, (uri) => {
    const resource = parseAiraResourceURI(uri);
    return resource && allowed.has(resourceKey(resource.kind, resource.id))
      ? uri
      : "未验证的音乐资源";
  });
}

function formatCard(card: AiraResourceCard) {
  return ["```aira-card", JSON.stringify(card), "```"].join("\n");
}

/** 只保留本轮成功工具结果能够证明的应用资源链接和卡片。 */
export function sanitizeAiraRichContent(text: string, messages: readonly LLMMessage[]) {
  if (!text.includes("aira://") && !text.includes("```aira-card")) return text;

  const allowed = readToolEvidence(messages);
  const document = parseAiraRichContent(text);
  return document.segments
    .map((segment) => {
      if (segment.type === "markdown") return sanitizeMarkdown(segment.content, allowed);
      return allowed.has(resourceKey(segment.card.kind, segment.card.id))
        ? formatCard(segment.card)
        : "> 音乐资源卡片未通过本轮工具结果验证，已省略。";
    })
    .join("");
}
