declare module "@neteasecloudmusicapienhanced/api/server.js" {
  import type { Express } from "express";

  export interface ModuleDefinition {
    identifier?: string;
    route: string;
    module: (
      query: any,
      request: (...args: any[]) => Promise<any>
    ) => Promise<{
      status: number;
      body: any;
      cookie?: string[];
    }>;
  }

  export interface ServeOptions {
    port?: number;
    host?: string;
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
  export default function (query: any, request: (...args: any[]) => Promise<any>);
  Promise<{
    status: number;
    body: any;
    cookie?: string[];
  }>;
}
