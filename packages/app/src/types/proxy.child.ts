export type ProxyParentMessage =
  | {
      type: "start";
      port: number;
      ncmPort: number;
      storePort: number;
      staticUIDir: string;
    }
  | {
      type: "stop";
    };

export type ProxyChildMessage =
  | {
      type: "ready";
      port: number;
    }
  | {
      type: "stopped";
    }
  | {
      type: "log";
      payload: {
        type: string;
        text: string;
      };
    }
  | {
      type: "error";
      error: {
        message: string;
        stack?: string;
      };
    };
