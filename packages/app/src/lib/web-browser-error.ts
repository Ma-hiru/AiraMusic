export class WebBrowserError extends Error {
  constructor(
    readonly code:
      | "busy"
      | "service"
      | "timeout"
      | "forbidden"
      | "page_expired"
      | "script_error"
      | "cache_expired"
      | "invalid_input",
    message: string
  ) {
    super(message);
    this.name = "WebBrowserError";
  }
}
