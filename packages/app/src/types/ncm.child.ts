export type NCMServerModule = typeof import("@neteasecloudmusicapienhanced/api/server.js");

export type NcmApiServer = NCMServerModule["default"];

export type NcmApiInstance = Awaited<ReturnType<NcmApiServer["serveNcmApi"]>>;

export type NCMParentMessage =
  | {
      type: "start";
      port: number;
      tokenPath?: string;
    }
  | {
      type: "stop";
    };

export type NCMChildMessage =
  | {
      type: "ready";
      port: number;
    }
  | {
      type: "stopped";
    }
  | {
      type: "error";
      error: {
        message: string;
        stack?: string;
      };
    };
