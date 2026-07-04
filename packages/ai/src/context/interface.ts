import type { AIInject } from "@/inject";
import type { LLMMessageText } from "@/provider";
import type { AIError, AIResult } from "@/result";

export type LLMContextMessageRole = Extract<LLMMessageText["role"], "user" | "system">;

export interface LLMContextRuntime {
  now: number;
  inject: AIInject;
  signal?: AbortSignal;
  conversationID?: string;
  metadata: Record<string, unknown>;
}

export abstract class LLMContextSource {
  readonly name: string;
  readonly priority?: number;
  readonly required?: boolean;

  protected constructor(props: {
    readonly name: string;
    readonly priority?: number;
    readonly required?: boolean;
  }) {
    this.name = props.name;
    this.priority = props.priority;
    this.required = props.required;
  }

  abstract load(runtime: LLMContextRuntime): Promise<AIResult<LLMContextBlock[]>>;
}

export interface LLMContextBlock {
  key: string;
  title?: string;
  content: string;
  priority?: number;
  expiresAt?: number;
  role?: LLMContextMessageRole;
  metadata?: Record<string, unknown>;
}

export type LLMContextBlockResolved = LLMContextBlock & {
  order: number;
  source: string;
  priority: number;
  role: LLMContextMessageRole;
};

export interface LLMContextComposeOptions {
  maxChars?: number;
  signal?: AbortSignal;
  conversationID?: string;
  metadata?: Record<string, unknown>;
  defaultRole?: LLMContextMessageRole;
}

export interface LLMContextComposeResult {
  messages: LLMMessageText[];
  blocks: LLMContextBlockResolved[];
  skippedSources: LLMContextSourceFailure[];
}

export interface LLMContextSourceFailure {
  error: AIError;
  source: string;
}

export interface LLMContextComposerOptions {
  inject: AIInject;
  defaultMaxChars?: number;
  now?: NormalFunc<[], number>;
  defaultRole?: LLMContextMessageRole;
  sources?: Iterable<LLMContextSource>;
}
