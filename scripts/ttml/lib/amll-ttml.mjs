/**
 * 把 Apple Music 返回的 TTML 归一化成 amll-ttml-db 的写法。
 *
 * 与 Apple 原始输出的差异（都是为了对齐 amll-ttml-db，避免"阉割"）：
 * 1. 时间统一成 `mm:ss.mmm`（超过一小时用 `hh:mm:ss.mmm`）；
 * 2. `<span ttm:role="x-bg">` 补上 begin/end —— Apple 不给和声组打时间，
 *    AMLL 解析器会把它当成 0 秒开始的独立行，导致和声挤在开头；
 * 3. 翻译以 `<span ttm:role="x-translation" xml:lang="...">` 追加在对应 `<p>` 末尾；
 * 4. head 里补 `amll:meta`，body 合并为单个 `<div>`；
 * 5. `<p>` 缺少 `itunes:key` 时按顺序补 `L{n}`。
 */

const TIMECODE_RE = /^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/;

/** 解析 TTML 时间：`ss.mmm` / `mm:ss.mmm` / `hh:mm:ss.mmm` */
export function parseTimecode(value) {
  if (!value) return null;
  const matched = String(value).trim().match(TIMECODE_RE);
  if (!matched) return null;
  const [, a, b, c] = matched;
  let seconds;
  if (b !== undefined) seconds = Number(a) * 3600 + Number(b) * 60 + Number(c);
  else if (a !== undefined) seconds = Number(a) * 60 + Number(c);
  else seconds = Number(c);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

/** 输出成 amll-ttml-db 的时间写法 */
export function formatTimecode(ms) {
  const value = Math.max(0, Math.round(ms));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = ((value % 60_000) / 1000).toFixed(3).padStart(6, "0");
  if (hours > 0)
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds}`;
  return `${String(minutes + hours * 60).padStart(2, "0")}:${seconds}`;
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readAttr(attrs, name) {
  const matched = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return matched ? matched[1] : null;
}

/** 把片段里所有 begin/end 规范化 */
function normalizeTimecodes(fragment) {
  return fragment.replace(/\b(begin|end)="([^"]+)"/g, (raw, name, value) => {
    const ms = parseTimecode(value);
    return ms == null ? raw : `${name}="${formatTimecode(ms)}"`;
  });
}

/**
 * 给 x-bg 组补 begin/end。Apple 的写法是：
 *   <span ttm:role="x-bg"><span begin=..>词</span>...</span>
 * 缺少外层时间的组会被解析成一个 0 秒开始的行。
 */
function fixBackgroundGroups(fragment) {
  const OPEN = '<span ttm:role="x-bg"';
  let output = "";
  let cursor = 0;

  while (cursor < fragment.length) {
    const start = fragment.indexOf(OPEN, cursor);
    if (start === -1) {
      output += fragment.slice(cursor);
      break;
    }
    output += fragment.slice(cursor, start);
    const tagEnd = fragment.indexOf(">", start);
    if (tagEnd === -1) {
      output += fragment.slice(start);
      break;
    }
    const openTag = fragment.slice(start, tagEnd + 1);

    let depth = 1;
    let scan = tagEnd + 1;
    while (scan < fragment.length && depth > 0) {
      const nextOpen = fragment.indexOf("<span", scan);
      const nextClose = fragment.indexOf("</span>", scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = fragment.indexOf(">", nextOpen) + 1;
      } else {
        depth--;
        scan = nextClose + 7;
      }
    }
    const inner = fragment.slice(tagEnd + 1, Math.max(tagEnd + 1, scan - 7));

    if (/\bbegin=/.test(openTag)) {
      output += openTag + inner + "</span>";
    } else {
      const begins = [...inner.matchAll(/\bbegin="([^"]+)"/g)]
        .map((item) => parseTimecode(item[1]))
        .filter((value) => value != null);
      const ends = [...inner.matchAll(/\bend="([^"]+)"/g)]
        .map((item) => parseTimecode(item[1]))
        .filter((value) => value != null);
      const extra =
        (begins.length ? ` begin="${formatTimecode(Math.min(...begins))}"` : "") +
        (ends.length ? ` end="${formatTimecode(Math.max(...ends))}"` : "");
      output += openTag.replace(/>$/, `${extra}>`) + inner + "</span>";
    }
    cursor = scan;
  }

  return output;
}

/** 取出逐词 span 的时间与文本（剔除和声组与翻译 span） */
export function extractWordSpans(fragment) {
  let cleaned = fragment;
  // 去掉 x-bg 组，它们不是主唱词元
  while (true) {
    const start = cleaned.indexOf('<span ttm:role="x-bg"');
    if (start === -1) break;
    const tagEnd = cleaned.indexOf(">", start);
    let depth = 1;
    let scan = tagEnd + 1;
    while (scan < cleaned.length && depth > 0) {
      const nextOpen = cleaned.indexOf("<span", scan);
      const nextClose = cleaned.indexOf("</span>", scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = cleaned.indexOf(">", nextOpen) + 1;
      } else {
        depth--;
        scan = nextClose + 7;
      }
    }
    cleaned = cleaned.slice(0, start) + cleaned.slice(scan);
  }

  const spans = [];
  for (const matched of cleaned.matchAll(
    /<span\b[^>]*\bbegin="([^"]+)"[^>]*\bend="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g
  )) {
    const begin = parseTimecode(matched[1]);
    const end = parseTimecode(matched[2]);
    if (begin == null || end == null) continue;
    spans.push({ begin, end, text: innerText(matched[3]) });
  }
  return spans;
}

/**
 * 把逐字罗马音对齐到 Apple 的词元上。
 *
 * QQ 的罗马音是"音节级 + 时间"，Apple 的词元是"词级 + 时间"，两边切分粒度不同，
 * 所以按行配对（就近 1.5s）后，再用「音节中点落在哪个词元区间」做归属，
 * 保证每个音节只落到一个词元上，不会重复也不会丢。
 */
export function alignRomanization(appleLines, qqLines, { tolerance = 1500 } = {}) {
  const result = new Map();
  if (!qqLines?.length) return result;

  const candidates = [...qqLines]
    .map((line) => ({
      startTime: line.startTime,
      words: (line.words ?? [])
        .map((word) => ({
          text: String(word.word ?? "").trim(),
          start: word.startTime,
          end: word.endTime
        }))
        .filter((word) => word.text)
    }))
    .filter((line) => line.words.length > 0);

  for (const line of appleLines) {
    // 逐行歌词没有词级时间，做不了逐字罗马音
    if (line.wordSpans.length < 2) continue;

    // 不用游标：对唱/和声会让多行同时存在，按"最近起点"配对更稳
    let nearest = null;
    for (const candidate of candidates) {
      const diff = Math.abs(candidate.startTime - line.begin);
      if (!nearest || diff < nearest.diff) nearest = { candidate, diff };
    }
    if (!nearest || nearest.diff > tolerance) continue;

    const spans = line.wordSpans.map((span) => ({ begin: span.begin, end: span.end, text: "" }));
    for (const syllable of nearest.candidate.words) {
      // 只吃本行时间范围内的音节，避免把下一行首音节粘到本行末词上
      if (syllable.start < line.begin - 200 || syllable.start > line.end + 200) continue;
      const mid = (syllable.start + syllable.end) / 2;
      // 落在词元区间内（左右各留 40ms 容差）
      let index = spans.findIndex((span) => mid >= span.begin - 40 && mid < span.end + 40);
      // 边界漏配时退化为最近的词元，避免整段丢失
      if (index === -1) {
        let bestDiff = Infinity;
        spans.forEach((span, i) => {
          const diff = mid < span.begin ? span.begin - mid : mid - span.end;
          if (diff < bestDiff) {
            bestDiff = diff;
            index = i;
          }
        });
        if (bestDiff > 150) continue;
      }
      spans[index].text += syllable.text;
    }
    if (spans.some((span) => span.text)) result.set(line.key, spans);
  }

  return result;
}

/**
 * 生成 `<iTunesMetadata><transliterations>` 片段（逐字罗马音）。
 * 每个 `<text for="Ln">` 内部按词元顺序给出等量的 span，解析器据此回填 romanWord。
 */
export function buildTransliterationsXML(parsed, transliterations, lang = "ja-Latn") {
  if (!transliterations || transliterations.size === 0) return "";
  const items = [];
  for (const line of parsed.lines) {
    const spans = transliterations.get(line.key);
    if (!spans) continue;
    const inner = spans
      .map(
        (span) =>
          `<span begin="${formatTimecode(span.begin)}" end="${formatTimecode(span.end)}">${escapeXml(
            span.text
          )}</span>`
      )
      .join("");
    items.push(`<text for="${escapeXml(line.key)}">${inner}</text>`);
  }
  if (items.length === 0) return "";
  return (
    `<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><transliterations>` +
    `<transliteration xml:lang="${escapeXml(lang)}">${items.join("")}</transliteration>` +
    `</transliterations></iTunesMetadata>`
  );
}

/**
 * 逐行型歌词只能做行级罗马音：把 QQ 该行的音节拼起来，
 * 写成 `<span ttm:role="x-roman">`，解析器会映射到 romanLyric。
 */
export function alignRomanizationLineLevel(
  appleLines,
  qqLines,
  { tolerance = 1500, includeWordTimed = false } = {}
) {
  const result = new Map();
  if (!qqLines?.length) return result;

  const candidates = qqLines
    .map((line) => ({
      startTime: line.startTime,
      text: (line.words ?? [])
        .map((word) => String(word.word ?? ""))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    }))
    .filter((line) => line.text);

  for (const line of appleLines) {
    // 逐字型默认跳过（另有 word-level 方案）；降级场景下允许一起做
    if (!includeWordTimed && line.wordSpans.length >= 2) continue;
    let nearest = null;
    for (const candidate of candidates) {
      const diff = Math.abs(candidate.startTime - line.begin);
      if (!nearest || diff < nearest.diff) nearest = { candidate, diff };
    }
    if (!nearest || nearest.diff > tolerance) continue;
    result.set(line.key, nearest.candidate.text);
  }

  return result;
}

/** 剥掉标签取纯文本，用于翻译比对 */
export function innerText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

/** 解析 Apple TTML，得到 headline 信息 + 逐行结构 */
export function parseAppleTTML(xml) {
  const rootAttrs = xml.match(/<tt\b([^>]*)>/)?.[1] ?? "";
  const lang = readAttr(rootAttrs, "xml:lang") ?? "";
  const timing = readAttr(rootAttrs, "itunes:timing") ?? "";

  const agents = [...xml.matchAll(/<ttm:agent\b([^>]*)\/>/g)].map((item) => ({
    type: readAttr(item[1], "type") ?? "other",
    id: readAttr(item[1], "xml:id") ?? "v1"
  }));

  const songwriters = [...xml.matchAll(/<songwriter>([^<]*)<\/songwriter>/g)].map((item) =>
    innerText(item[1])
  );

  const leadingSilence = xml.match(/<iTunesMetadata\b[^>]*\bleadingSilence="([^"]+)"/)?.[1] ?? null;

  const bodyAttrs = xml.match(/<body\b([^>]*)>/)?.[1] ?? "";
  const duration = parseTimecode(readAttr(bodyAttrs, "dur") ?? "");

  const lines = [...xml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map((item, index) => {
    const attrs = item[1];
    const begin = parseTimecode(readAttr(attrs, "begin"));
    const end = parseTimecode(readAttr(attrs, "end"));
    const agent = readAttr(attrs, "ttm:agent");
    const key = readAttr(attrs, "itunes:key") ?? `L${index + 1}`;
    const fragment = fixBackgroundGroups(item[2]);
    return {
      begin: begin ?? 0,
      end: end ?? begin ?? 0,
      agent,
      key,
      words: fragment,
      wordSpans: extractWordSpans(fragment)
    };
  });

  // Apple 的 <translations> 用 <text for="L1"> 引用行 key，可作为网易云缺失时的兜底
  const appleTranslations = new Map();
  const translationBlock = xml.match(/<translations>([\s\S]*?)<\/translations>/)?.[1] ?? "";
  for (const item of translationBlock.matchAll(/<text for="([^"]+)">([\s\S]*?)<\/text>/g)) {
    const text = innerText(item[2]);
    if (text) appleTranslations.set(item[1], { lang, text });
  }

  // Apple 对部分歌曲只给"无时间轴"的纯文本歌词（<p> 没有 begin/end），这种不能当正常歌词用
  const untimed = lines.length > 0 && lines.every((line) => line.begin === 0 && line.end === 0);

  return {
    lang,
    timing,
    agents,
    songwriters,
    leadingSilence,
    duration,
    lines,
    appleTranslations,
    untimed
  };
}

/**
 * 用 LRC 翻译逐行对齐。LRC 的时间与 Apple 有几十到几百毫秒偏差，取最近邻。
 * 返回 Map<key, string>
 */
export function alignTranslation(lines, entries, { tolerance = 1200 } = {}) {
  const result = new Map();
  if (!entries?.length) return result;
  const sorted = [...entries].sort((a, b) => a.time - b.time);
  let cursor = 0;

  for (const line of lines) {
    while (cursor < sorted.length && sorted[cursor].time < line.begin - tolerance) cursor++;
    const candidate = sorted[cursor];
    if (!candidate) break;
    if (Math.abs(candidate.time - line.begin) <= tolerance) {
      if (candidate.text) result.set(line.key, candidate.text);
      cursor++;
    }
  }

  return result;
}

/**
 * 生成归一化后的 TTML。
 * @param {object} options
 * @param {ReturnType<typeof parseAppleTTML>} options.parsed
 * @param {Record<string,string>} options.meta amll:meta 键值
 * @param {Map<string,string>} [options.translations] key → 译文
 * @param {string} [options.translationLang]
 * @param {string} [options.timingOverride]
 */
export function buildAMLLTTML({
  parsed,
  meta,
  translations = new Map(),
  translationLang = "zh-Hans",
  transliterations = new Map(),
  transliterationLang = "ja-Latn",
  timingOverride
}) {
  // 有些文件 head 里没有 ttm:agent 声明，但 <p> 仍然引用；必须先补齐，
  // 否则 AMLL 会把所有行都判成对唱。
  const referenced = [...new Set(parsed.lines.map((line) => line.agent).filter(Boolean))];
  const agents = [...parsed.agents];
  for (const id of referenced) {
    if (!agents.some((agent) => agent.id === id)) agents.push({ id, type: "person" });
  }

  // 代理人 ID 归一：Apple 用 v1/v2000，amll-ttml-db 用 v1/v2
  const agentAlias = new Map();
  agents.forEach((agent, index) => {
    agentAlias.set(agent.id, index === 0 ? "v1" : `v${index + 1}`);
  });

  const timing = timingOverride ?? parsed.timing;
  const head = [];
  head.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" ` +
      `xmlns:itunes="http://music.apple.com/lyric-ttml-internal" ` +
      `xmlns:amll="http://www.example.com/ns/amll"` +
      (timing ? ` itunes:timing="${timing}"` : "") +
      (parsed.lang ? ` xml:lang="${parsed.lang}"` : "") +
      `>`
  );

  const metadata = [];
  for (const agent of agents) {
    metadata.push(
      `<ttm:agent type="${escapeXml(agent.type)}" xml:id="${escapeXml(agentAlias.get(agent.id))}"/>`
    );
  }
  for (const [key, value] of Object.entries(meta)) {
    if (value == null || value === "") continue;
    metadata.push(`<amll:meta key="${escapeXml(key)}" value="${escapeXml(value)}"/>`);
  }
  const transliterationXML = buildTransliterationsXML(
    parsed,
    transliterations,
    transliterationLang
  );
  if (transliterationXML) metadata.push(transliterationXML);

  head.push(`<head><metadata>${metadata.join("")}</metadata></head>`);

  const bodyLines = parsed.lines.map((line) => {
    const agent = line.agent ? (agentAlias.get(line.agent) ?? line.agent) : null;
    const attributes = [
      `begin="${formatTimecode(line.begin)}"`,
      `end="${formatTimecode(line.end)}"`,
      agent ? `ttm:agent="${escapeXml(agent)}"` : null,
      `itunes:key="${escapeXml(line.key)}"`
    ].filter(Boolean);

    let inner = normalizeTimecodes(line.words);
    const translation = translations.get(line.key);
    if (translation) {
      inner += `<span ttm:role="x-translation" xml:lang="${escapeXml(translationLang)}">${escapeXml(
        translation
      )}</span>`;
    }
    return `<p ${attributes.join(" ")}>${inner}</p>`;
  });

  const first = parsed.lines[0]?.begin ?? 0;
  const last = parsed.lines.reduce((max, line) => Math.max(max, line.end), 0);
  const duration = parsed.duration ?? last;

  head.push(
    `<body dur="${formatTimecode(duration)}"><div begin="${formatTimecode(first)}" end="${formatTimecode(
      last
    )}">${bodyLines.join("")}</div></body></tt>`
  );

  return {
    ttml: head.join(""),
    stats: {
      lines: parsed.lines.length,
      wordLines: parsed.lines.filter((line) => /<span\b/.test(line.words)).length,
      bgGroups: parsed.lines
        .map((line) => (line.words.match(/x-bg/g) ?? []).length)
        .reduce((sum, count) => sum + count, 0),
      translations: [...translations.keys()].length,
      transliterations: transliterations.size,
      agents: parsed.agents.length
    }
  };
}
