import type { SerializedError } from "@/types/child";

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
      type: "error";
      error: SerializedError;
    }
  | {
      type: "log";
      payload: {
        text: string;
        type: string;
      };
    };
