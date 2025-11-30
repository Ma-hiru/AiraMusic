interface ENV {
  readonly APP_MODE: string;
  readonly APP_SCHEME: string;
  readonly APP_PROTOCOL: string;
  readonly NCM_SERVER_PORT: string;
  readonly GO_SERVER_PORT: string;
  readonly EXPRESS_SERVER_PORT: string;
  readonly VITE_SERVER_PORT: string;
  readonly UI_LOG_LEVEL: EnvLogLevel;
  readonly APP_LOG_LEVEL: EnvLogLevel;
}

type EnvLogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "NONE";
