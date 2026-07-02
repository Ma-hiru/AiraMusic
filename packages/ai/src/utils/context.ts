import type { LLMContextBlockResolved } from "@/context/interface";

export function sortResolvedBlocks(blocks: LLMContextBlockResolved[]): LLMContextBlockResolved[] {
  return [...blocks].sort((left, right) => {
    if (left.priority !== right.priority) return right.priority - left.priority;
    return left.order - right.order;
  });
}

export function limitResolvedBlocksChars(
  blocks: LLMContextBlockResolved[],
  maxChars: number
): LLMContextBlockResolved[] {
  if (maxChars <= 0) return [];

  const selected: LLMContextBlockResolved[] = [];
  let remaining = maxChars;

  for (const block of blocks) {
    const rendered = formatResolvedBlock(block);
    if (rendered.length <= remaining) {
      selected.push(block);
      remaining -= rendered.length;
      continue;
    }

    if (remaining - blockHeader(block).length <= 8) break;
    selected.push({
      ...block,
      content: truncateContent(block.content, remaining - blockHeader(block).length)
    });
    break;
  }

  return selected;
}

export function formatResolvedBlock(block: LLMContextBlockResolved) {
  return `${blockHeader(block)}\n${block.content}`;
}

function blockHeader(block: LLMContextBlockResolved) {
  return `[${block.title ?? block.key}]`;
}

function truncateContent(content: string, maxChars: number) {
  if (maxChars <= 0) return "";
  if (content.length <= maxChars) return content;
  if (maxChars <= 3) return content.slice(0, maxChars);
  return `${content.slice(0, maxChars - 3)}...`;
}
