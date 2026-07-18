export const LLMDefaultContextWindowTokens = 128_000;
export const LLMMinimumContextWindowTokens = 16_384;

/**
 * 各模型服务提供方在官方模型文档中公布的上下文窗口。
 * OpenAI：https://developers.openai.com/api/docs/models
 * DeepSeek V4：https://api-docs.deepseek.com/news/news260424/
 */
export const LLMKnownModelContextWindowTokens = {
  "gpt-5.6": 1_050_000,
  "gpt-5.6-sol": 1_050_000,
  "gpt-5.6-terra": 1_050_000,
  "gpt-5.6-luna": 1_050_000,
  "gpt-5.5": 1_050_000,
  "gpt-5.5-pro": 1_050_000,
  "gpt-5.4": 1_050_000,
  "gpt-5.4-pro": 1_050_000,
  "gpt-5.4-mini": 400_000,
  "gpt-5.4-nano": 400_000,
  "gpt-5": 400_000,
  "gpt-5-mini": 400_000,
  "gpt-5-nano": 400_000,
  "gpt-4.1": 1_047_576,
  "gpt-4.1-mini": 1_047_576,
  "gpt-4.1-nano": 1_047_576,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  o3: 200_000,
  "o3-pro": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
  "deepseek-v4-pro": 1_000_000,
  "deepseek-v4-flash": 1_000_000
} as const satisfies Readonly<Record<string, number>>;

const DatedSnapshotSuffix = "\\d{4}-\\d{2}-\\d{2}";

const LLMModelContextWindowPatterns: ReadonlyArray<readonly [RegExp, number]> = [
  [new RegExp(`^gpt-5(?:-(?:mini|nano))?-${DatedSnapshotSuffix}$`), 400_000],
  [new RegExp(`^gpt-5\\.(?:4|5)(?:-pro)?-${DatedSnapshotSuffix}$`), 1_050_000],
  [new RegExp(`^gpt-5\\.4-(?:mini|nano)-${DatedSnapshotSuffix}$`), 400_000],
  [new RegExp(`^gpt-4\\.1(?:-(?:mini|nano))?-${DatedSnapshotSuffix}$`), 1_047_576],
  [new RegExp(`^gpt-4o(?:-mini)?-${DatedSnapshotSuffix}$`), 128_000],
  [new RegExp(`^(?:o3|o3-mini|o4-mini)-${DatedSnapshotSuffix}$`), 200_000]
];

export function resolveLLMContextWindowTokens(model: string, override?: number): number {
  if (isPositiveInteger(override)) return override;

  const normalizedModel = model.trim().toLowerCase();
  const exact =
    LLMKnownModelContextWindowTokens[
      normalizedModel as keyof typeof LLMKnownModelContextWindowTokens
    ];
  if (exact !== undefined) return exact;

  const pattern = LLMModelContextWindowPatterns.find(([matcher]) => matcher.test(normalizedModel));
  return pattern?.[1] ?? LLMDefaultContextWindowTokens;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
