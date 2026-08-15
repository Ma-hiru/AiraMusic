export type ProxyParentMessage =
  | {
      type: "stop";
    }
  | {
      key: string;
      cert: string;
      port: number;
      type: "start";
      ncmPort: number;
      storePort: number;
      staticUIDir: string;
    };

export type ProxyChildMessage =
  | {
      type: "stopped";
    }
  | {
      port: number;
      type: "ready";
    }
  | {
      type: "log";
      payload: {
        text: string;
        type: string;
      };
    }
  | {
      type: "error";
      error: {
        stack?: string;
        message: string;
      };
    };
