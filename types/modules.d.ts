declare module "@neteasecloudmusicapienhanced/api/server.js" {
  import type { Express } from "express";

  export interface ModuleDefinition {
    route: string;
    identifier?: string;
    module: (
      query: any,
      request: (...args: any[]) => Promise<any>
    ) => Promise<{
      body: any;
      status: number;
      cookie?: string[];
    }>;
  }

  export interface ServeOptions {
    host?: string;
    port?: number;
    checkVersion?: boolean;
    moduleDefs?: ModuleDefinition[];
  }

  export function serveNcmApi(
    options: ServeOptions
  ): Promise<Express & { server?: import("http").Server }>;

  export function getModulesDefinitions(
    modulesPath: string,
    specificRoute?: Record<string, string>,
    doRequire?: boolean
  ): Promise<ModuleDefinition[]>;

  const _default: {
    serveNcmApi: typeof serveNcmApi;
    getModulesDefinitions: typeof getModulesDefinitions;
  };

  export default _default;
}

declare module "@neteasecloudmusicapienhanced/api/module/*.js" {
  export default function (
    query: any,
    request: (...args: any[]) => Promise<any>
  ): Promise<{
    body: any;
    status: number;
    cookie?: string[];
  }>;
}

declare module "@neteasecloudmusicapienhanced/api/generateConfig.js" {
  const generateConfig: () => Promise<void>;
  export default generateConfig;
}

declare module "@neteasecloudmusicapienhanced/api/util/xeapiKey.js" {
  export interface XeapiPublicKey {
    sk?: string;
    version?: string;
    deviceId?: string;
    publicKey?: string;
    [key: string]: unknown;
  }
  export function getXeapiPublicKey(
    currentPublicKey?: Record<string, unknown>,
    deviceId?: string
  ): Promise<XeapiPublicKey>;
  const _default: { getXeapiPublicKey: typeof getXeapiPublicKey };
  export default _default;
}

declare module "@neteasecloudmusicapienhanced/api/util/index.js" {
  export function generateRandomChineseIP(): string;
  export function generateDeviceId(): string;
  export function cookieToJson(cookie?: string): Record<string, string>;
  export function cookieObjToString(cookie: Record<string, number | string>): string;
  export function toBoolean(val: unknown): boolean;
  const _default: {
    toBoolean: typeof toBoolean;
    cookieToJson: typeof cookieToJson;
    generateDeviceId: typeof generateDeviceId;
    cookieObjToString: typeof cookieObjToString;
    generateRandomChineseIP: typeof generateRandomChineseIP;
  };
  export default _default;
}
