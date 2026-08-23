import { z } from "zod";

export const AiraResourceKinds = ["track", "album", "playlist", "artist"] as const;
export const AiraResourceActions = ["open", "play", "queue"] as const;
export const AiraResourceCardVariants = ["compact", "featured"] as const;

export type AiraResourceKind = (typeof AiraResourceKinds)[number];
export type AiraResourceAction = (typeof AiraResourceActions)[number];
export type AiraResourceCardVariant = (typeof AiraResourceCardVariants)[number];

const AiraResourceIDSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const AiraResourceReferenceSchema = z
  .object({
    kind: z.enum(AiraResourceKinds),
    id: AiraResourceIDSchema
  })
  .strict();

const AiraResourceCardVariantSchema = z.enum(AiraResourceCardVariants).optional();
const AiraCollectionActionSchema = z.enum(AiraResourceActions).optional();

export const AiraResourceCardSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("track"),
      id: AiraResourceIDSchema,
      action: z.enum(["play", "queue"]).optional(),
      variant: AiraResourceCardVariantSchema
    })
    .strict(),
  ...(["album", "playlist", "artist"] as const).map((kind) =>
    z
      .object({
        kind: z.literal(kind),
        id: AiraResourceIDSchema,
        action: AiraCollectionActionSchema,
        variant: AiraResourceCardVariantSchema
      })
      .strict()
  )
]);

export type AiraResourceReference = z.infer<typeof AiraResourceReferenceSchema>;
export type AiraResourceCard = z.infer<typeof AiraResourceCardSchema>;

export type AiraRichContentSegment =
  | {
      content: string;
      type: "markdown";
    }
  | {
      type: "card";
      card: AiraResourceCard;
    };

export interface AiraRichContentDocument {
  /** 未经改写的模型原文，便于调用方在任何异常下完整降级。 */
  source: string;
  /** 严格按照原文顺序排列的 Markdown 与卡片片段。 */
  segments: AiraRichContentSegment[];
  /** 已通过协议校验的卡片，顺序与 segments 中一致。 */
  cards: AiraResourceCard[];
  /** 流式输出末尾存在尚未闭合的卡片围栏。 */
  pendingCard?: true;
}

export interface ParseAiraRichContentOptions {
  /** 本次最多解析的卡片数，只能收紧内置上限。 */
  maxCards?: number;
  /** 单个卡片围栏正文的最大字符数，只能收紧内置上限。 */
  maxCardChars?: number;
  /** 允许进入富内容解析器的全文最大字符数，只能收紧内置上限。 */
  maxContentChars?: number;
  /** 流式渲染时隐藏末尾尚未闭合的卡片协议，避免暴露内部 JSON。 */
  streaming?: boolean;
}
