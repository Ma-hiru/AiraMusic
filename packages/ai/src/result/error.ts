export type AIErrorCode =
  | "raw"
  | "auth" // 401/403
  | "inner" // 内部错误
  | "aborted" // 用户主动中止（注意：不是真正的"错误"）
  | "network" // fetch 网络层失败
  | "service" // 服务端错误
  | "timeout" // 超时
  | "unknown"
  | "no_config" // 未配置或缺 key
  | "rate_limit" // 429
  | "bad_response" // SSE/JSON 形状异常
  | "context_load" // context source 加载失败
  | "unknown_tool" // 工具调用校验失败（一般不阻断消息）
  | "run_not_found" // agent run 不存在
  | "config_storage" // provider config / apiKey 存储读写失败
  | "invalid_config" // 配置不完整/解密失败
  | "invalid_actions" // 动作块校验失败（一般不阻断消息）
  | "model_not_found" // 404
  | "conversation_busy" // 同会话已有活跃流
  | "invalid_tool_call" // 工具调用校验失败（一般不阻断消息）
  | "invalid_tool_config" // 工具配置校验失败（一般不阻断消息）
  | "conversation_storage" // conversation 存储读写失败
  | "invalid_conversation" // conversation 历史或顺序不合法
  | "has_pending_tool_call" // 工具调用未完成
  | "invalid_prompt_config" // prompt 组装配置不合法
  | "invalid_context_config"; // context source 或 block 配置不合法

export class AIError extends Error {
  readonly type: AIErrorCode;
  readonly raw?: unknown;
  private readonly chain: AIError[];
  override readonly name: string;
  override readonly stack?: string;
  override readonly message: string;

  constructor(props: {
    name?: string;
    raw?: unknown;
    message: string;
    concat?: AIError;
    type: AIErrorCode;
  }) {
    super(props.message);
    this.type = props.type;
    this.message = props.message;
    this.name = props.name ?? "AIError";
    this.chain = [this];
    this.raw = props.raw;
    props.concat && this.concat(props.concat);
  }

  concat(last: AIError) {
    this.chain.push(...last.chain);
    return this;
  }

  static get empty() {
    return new AIError({
      type: "unknown",
      message: "empty error"
    });
  }

  static raw(e: unknown) {
    return new AIError({
      type: "unknown",
      message: String(e),
      raw: e
    });
  }

  override toString() {
    return this.chain.map((error) => `${error.name}: ${error.message}`).join(" => ");
  }

  [Symbol.toPrimitive]() {
    return this.toString();
  }
}
