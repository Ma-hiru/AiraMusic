export type NCMServerModule = typeof import("@neteasecloudmusicapienhanced/api/server.js");

export type NcmApiServer = NCMServerModule["default"];

export type NcmApiInstance = Awaited<ReturnType<NcmApiServer["serveNcmApi"]>>;

export type NCMParentMessage =
  | {
      type: "stop";
    }
  | {
      port: number;
      type: "start";
      tokenPath?: string;
      deviceIdPath?: string;
    };

export type NCMChildMessage =
  | {
      type: "stopped";
    }
  | {
      port: number;
      type: "ready";
    }
  | {
      type: "error";
      error: {
        stack?: string;
        message: string;
      };
    };
