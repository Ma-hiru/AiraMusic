import {
  type AiraResourceCard,
  AiraResourceCardSchema,
  type AiraResourceAction,
  type AiraResourceReference,
  AiraResourceReferenceSchema,
  type AiraRichContentSegment,
  type AiraRichContentDocument,
  type ParseAiraRichContentOptions
} from "./interface";

export const AiraRichContentLimits = Object.freeze({
  maxCards: 8,
  maxCardChars: 2_048,
  maxContentChars: 256_000
});

const AiraResourceURIExpression = /^aira:\/\/(track|album|playlist|artist)\/([1-9]\d*)$/;

type MarkdownLine = {
  end: number;
  text: string;
  start: number;
  rawEnd: number;
};

type MarkdownFence = {
  info: string;
  length: number;
  marker: "`" | "~";
};

type ValidCardRange = {
  end: number;
  start: number;
  card: AiraResourceCard;
};

type CardScanResult = {
  ranges: ValidCardRange[];
  pendingCardStart?: number;
};

export function parseAiraResourceURI(uri: string): null | AiraResourceReference {
  const match = AiraResourceURIExpression.exec(uri);
  if (!match) return null;

  const parsed = AiraResourceReferenceSchema.safeParse({
    kind: match[1],
    id: Number(match[2])
  });
  return parsed.success ? parsed.data : null;
}

export function formatAiraResourceURI(reference: AiraResourceReference): string {
  const parsed = AiraResourceReferenceSchema.safeParse(reference);
  if (!parsed.success) throw new TypeError("Aira 资源链接包含无效的类型或 ID");
  return `aira://${parsed.data.kind}/${parsed.data.id}`;
}

export function resolveAiraResourceAction(
  resource: AiraResourceReference & { action?: AiraResourceAction }
): AiraResourceAction {
  return resource.action ?? (resource.kind === "track" ? "play" : "open");
}

export function parseAiraRichContent(
  source: string,
  options: ParseAiraRichContentOptions = {}
): AiraRichContentDocument {
  if (!source) return { source, segments: [], cards: [] };

  const maxContentChars = resolveLimit(
    options.maxContentChars,
    AiraRichContentLimits.maxContentChars
  );
  if (source.length > maxContentChars) return markdownOnly(source);

  const maxCards = resolveLimit(options.maxCards, AiraRichContentLimits.maxCards);
  const maxCardChars = resolveLimit(options.maxCardChars, AiraRichContentLimits.maxCardChars);
  if (!maxCards || !maxCardChars) return markdownOnly(source);

  const scan = findValidCards(source, maxCards, maxCardChars, options.streaming === true);
  const visibleEnd = scan.pendingCardStart ?? source.length;
  if (!scan.ranges.length && scan.pendingCardStart === undefined) return markdownOnly(source);

  const segments: AiraRichContentSegment[] = [];
  const cards: AiraResourceCard[] = [];
  let cursor = 0;

  for (const range of scan.ranges) {
    pushMarkdown(segments, source.slice(cursor, range.start));
    segments.push({ type: "card", card: range.card });
    cards.push(range.card);
    cursor = range.end;
  }
  pushMarkdown(segments, source.slice(cursor, visibleEnd));

  return {
    source,
    segments,
    cards,
    ...(scan.pendingCardStart === undefined ? {} : { pendingCard: true as const })
  };
}

function findValidCards(
  source: string,
  maxCards: number,
  maxCardChars: number,
  streaming: boolean
): CardScanResult {
  const ranges: ValidCardRange[] = [];
  let cursor = 0;

  while (cursor < source.length && ranges.length < maxCards) {
    const openingLine = readLine(source, cursor);
    const openingFence = parseFence(openingLine.text);
    if (!openingFence) {
      cursor = openingLine.end;
      continue;
    }

    const isCardFence =
      openingFence.marker === "`" && openingFence.length === 3 && openingFence.info === "aira-card";
    const closingLine = findClosingFence(source, openingLine.end, openingFence);
    if (!closingLine) {
      const pendingChars = source.length - openingLine.end;
      return {
        ranges,
        ...(streaming && isCardFence && pendingChars <= maxCardChars
          ? { pendingCardStart: openingLine.start }
          : {})
      };
    }

    if (isCardFence) {
      const body = source.slice(openingLine.end, closingLine.start);
      if (body.length <= maxCardChars) {
        const card = parseCardJSON(body);
        if (card) {
          ranges.push({ start: openingLine.start, end: closingLine.rawEnd, card });
        }
      }
    }

    // 无论卡片是否合法，都跳过当前围栏，避免把其中的文本误判成嵌套卡片。
    cursor = closingLine.end;
  }

  return { ranges };
}

function parseCardJSON(body: string): null | AiraResourceCard {
  try {
    const raw: unknown = JSON.parse(body.trim());
    const parsed = AiraResourceCardSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readLine(source: string, start: number): MarkdownLine {
  const lineFeed = source.indexOf("\n", start);
  const rawEnd = lineFeed < 0 ? source.length : lineFeed;
  const textEnd = rawEnd > start && source[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
  return {
    start,
    rawEnd,
    end: lineFeed < 0 ? source.length : lineFeed + 1,
    text: source.slice(start, textEnd)
  };
}

function parseFence(line: string): null | MarkdownFence {
  let index = 0;
  while (index < line.length && index < 3 && line[index] === " ") index++;
  const marker = line[index];
  if (marker !== "`" && marker !== "~") return null;

  let length = 0;
  while (line[index + length] === marker) length++;
  if (length < 3) return null;

  return {
    marker,
    length,
    info: line.slice(index + length).trim()
  };
}

function findClosingFence(
  source: string,
  start: number,
  opening: MarkdownFence
): null | MarkdownLine {
  let cursor = start;
  while (cursor < source.length) {
    const line = readLine(source, cursor);
    const fence = parseFence(line.text);
    if (fence && fence.marker === opening.marker && fence.length >= opening.length && !fence.info) {
      return line;
    }
    cursor = line.end;
  }
  return null;
}

function pushMarkdown(segments: AiraRichContentSegment[], content: string) {
  if (!content) return;
  const previous = segments.at(-1);
  if (previous?.type === "markdown") {
    previous.content += content;
  } else {
    segments.push({ type: "markdown", content });
  }
}

function markdownOnly(source: string): AiraRichContentDocument {
  return {
    source,
    cards: [],
    segments: [{ type: "markdown", content: source }]
  };
}

function resolveLimit(value: number | undefined, hardLimit: number): number {
  if (value === undefined || !Number.isFinite(value)) return hardLimit;
  return Math.min(hardLimit, Math.max(0, Math.floor(value)));
}
