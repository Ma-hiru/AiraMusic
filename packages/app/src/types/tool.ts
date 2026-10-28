import { z } from "zod";
import type { AgentToolRequest } from "@mahiru/ipc/types";

export type McpToolOutputDetail = "compact" | "detailed" | "standard";

export enum McpToolRisk {
  Read = "read",
  Write = "write",
  Destructive = "destructive"
}

export interface McpToolContext {
  signal?: AbortSignal;
  conversationID: string;
  access?: "public" | "internal";
  outputDetail: McpToolOutputDetail;
}

export interface McpTool<TInput = unknown> {
  name: string;
  risk: McpToolRisk;
  timeoutMs: number;
  description: string;
  execution: "main" | "renderer";
  inputSchema: z.ZodType<TInput>;
  /** 参数已经由 MCP SDK 按 inputSchema 校验。 */
  execute(input: TInput, context?: McpToolContext): Promise<unknown>;
  openWorld: boolean;
}

export class McpToolError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

export type ToolOptions<TSchema extends z.ZodObject> = {
  name: string;
  risk: McpToolRisk;
  timeoutMs?: number;
  description: string;
  openWorld?: boolean;
  inputSchema: TSchema;
  execution?: "main" | "renderer";
  execute(input: z.output<TSchema>, context: McpToolContext): unknown | Promise<unknown>;
};

export type RendererToolName = AgentToolRequest["tool"];

export type RendererToolOptions<TSchema extends z.ZodObject> = Omit<
  ToolOptions<TSchema>,
  "name" | "execute" | "execution"
> & {
  name: RendererToolName;
  commitUnknownOnTimeout?: boolean;
  mapInput?: (input: z.output<TSchema>) => unknown;
};
