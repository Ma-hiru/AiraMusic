/**
 * 把模型内联的 <think> 推理内容与正式回答分离。
 * 只在围栏代码块之外识别标签；流式期间未闭合的尾巴视为正在思考。
 */
export type ThinkSegment =
  | { type: "text"; content: string }
  | { type: "think"; closed: boolean; content: string };

const ThinkOpenPattern = /^[ \t]*<think>[ \t]*\r?\n?/i;
const ThinkClosePattern = /\r?\n?[ \t]*<\/think>[ \t]*/i;
const FenceLinePattern = /^ {0,3}(`{3,}|~{3,})/;

export function splitThinkSegments(source: string): ThinkSegment[] {
  if (!source || !/<think>/i.test(source)) {
    return source ? [{ type: "text", content: source }] : [];
  }

  const segments: ThinkSegment[] = [];
  let cursor = 0;
  let fenced = false;

  while (cursor < source.length) {
    const lineEnd = source.indexOf("\n", cursor);
    const line = lineEnd < 0 ? source.slice(cursor) : source.slice(cursor, lineEnd);

    if (FenceLinePattern.test(line)) {
      fenced = !fenced;
      cursor = lineEnd < 0 ? source.length : lineEnd + 1;
      continue;
    }

    if (!fenced && ThinkOpenPattern.test(line)) {
      const openMatch = ThinkOpenPattern.exec(line)!;
      const thinkStart = cursor + openMatch[0].length;
      const close = ThinkClosePattern.exec(source.slice(thinkStart));
      const before = source.slice(0, cursor);
      pushText(segments, before);

      if (close) {
        const thinkContent = source.slice(thinkStart, thinkStart + close.index);
        const after = source.slice(thinkStart + close.index + close[0].length);
        pushThink(segments, thinkContent, true);
        return [...segments, ...splitThinkSegments(after)];
      }

      pushThink(segments, source.slice(thinkStart), false);
      return segments;
    }

    cursor = lineEnd < 0 ? source.length : lineEnd + 1;
  }

  // 全文没有命中 think（例如只有围栏代码）时保留原始内容
  if (!segments.length && source) segments.push({ type: "text", content: source });
  return segments;
}

function pushText(segments: ThinkSegment[], content: string) {
  if (!content) return;
  const previous = segments.at(-1);
  if (previous?.type === "text") previous.content += content;
  else segments.push({ type: "text", content });
}

function pushThink(segments: ThinkSegment[], content: string, closed: boolean) {
  const trimmed = content.replace(/^\s+|\s+$/g, "");
  if (!trimmed && closed) return;
  const previous = segments.at(-1);
  if (previous?.type === "think" && !previous.closed) {
    previous.content = `${previous.content}\n${trimmed}`;
    previous.closed = closed;
    return;
  }
  segments.push({ type: "think", content: trimmed, closed });
}
