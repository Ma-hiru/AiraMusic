import { doLogout } from "./auth";
import axios, { AxiosResponse } from "axios";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { Log } from "@mahiru/ui/utils/log";

// 开发模式通过VITE代理访问API服务器地址
// 生产模式通过express访问API服务器地址
const NETEASE_API_BASE_URL = "/api";

if (!NETEASE_API_BASE_URL) {
  Log.error("ui/request.ts", "NETEASE_API_BASE_URL is not defined.");
}

const service = axios.create({
  baseURL: NETEASE_API_BASE_URL,
  withCredentials: true,
  timeout: 15000
});

service.interceptors.request.use((config) => {
  config.params ||= {};

  if (!config.baseURL?.length) {
    Log.error("ui/request.ts", "Missing baseURL in axios request.");
  }

  const { settings } = usePersistZustandStore.getState();
  if (settings.enableRealIP && settings.realIP) {
    config.params.realIP ??= settings.realIP;
  }

  const proxy = settings.proxyConfig;
  const protocol = proxy?.protocol?.toUpperCase();
  if (protocol && ["HTTP", "HTTPS"].includes(protocol) && proxy.server && proxy.port) {
    config.params.proxy = `${protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const axiosResponse: AxiosResponse | undefined = error?.response;
    const data = axiosResponse?.data;

    if (!axiosResponse && typeof error?.message === "string" && error.message.includes("baseURL")) {
      Log.error("ui/request.ts", "Missing baseURL in axios request.");
    }

    if (
      axiosResponse &&
      typeof data === "object" &&
      data !== null &&
      (data as { code?: number; msg?: string }).code === 301 &&
      (data as { code?: number; msg?: string }).msg === "需要登录"
    ) {
      Log.warn("ui/request.ts", "Token has expired.");
      doLogout();
      //TODO: router redirect to login page
    }

    return Promise.reject(error);
  }
);

export default service;
