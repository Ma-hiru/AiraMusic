import { doLogout } from "./auth";
import axios, { AxiosResponse } from "axios";
import { Log } from "@mahiru/ui/utils/log";

// 开发模式通过VITE代理访问API服务器地址
// 生产模式通过express访问API服务器地址
const NETEASE_API_BASE_URL = "/api";
const GIN_CACHE_API_BASE_URL = "/cache";

if (!NETEASE_API_BASE_URL) {
  Log.error("ui/request.ts", "NETEASE_API_BASE_URL is not defined.");
}

const service = axios.create({
  baseURL: NETEASE_API_BASE_URL,
  withCredentials: true,
  timeout: 15000
});
const cacheService = axios.create({
  withCredentials: true,
  timeout: 30000
});

service.interceptors.request.use((config) => {
  if (!config.baseURL?.length) {
    Log.error("ui/request.ts", "Missing baseURL in axios request.");
  }
  return config;
});
cacheService.interceptors.request.use((config) => {
  const { update, time_limit, ...rest } = config?.params || {};
  const rawRequestPrams = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      rawRequestPrams.append(key, String(value));
    }
  });
  config.url = `${config.url}?${rawRequestPrams.toString()}`;
  const requestParams = new URLSearchParams();
  requestParams.append("url", encodeURIComponent(`http://127.0.0.1:10754${config.url}`));
  // 手动刷新
  requestParams.append("update", update ? "true" : "false");
  // 自动过期时间
  console.log("config?.params", config?.params);
  time_limit && requestParams.append("time_limit", String(time_limit));
  config.url = `${GIN_CACHE_API_BASE_URL}/api/wrap?${requestParams.toString()}`;
  return config;
});

const responseInterceptor = async (error: any) => {
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
    window.node.event.createLoginWindow();
  }

  return Promise.reject(error);
};
service.interceptors.response.use((response) => response.data, responseInterceptor);
cacheService.interceptors.response.use((response) => response.data, responseInterceptor);
export default service;
/** 仅支持prams为对象时的查询参数 */
export const cacheRequest = cacheService;
