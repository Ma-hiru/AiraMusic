import axios, { AxiosResponse } from "axios";
import { doLogout } from "./auth";
import { Log } from "@mahiru/ui/utils/log";

// 开发模式通过VITE代理访问API服务器地址
// 生产模式通过express访问API服务器地址
const NETEASE_API_BASE_URL = "/api";

if (!NETEASE_API_BASE_URL) {
  Log.error("ui/request.ts", "NETEASE_API_BASE_URL is not defined.");
}

const request = axios.create({
  baseURL: NETEASE_API_BASE_URL,
  withCredentials: true,
  timeout: 15000
});

request.interceptors.request.use((config) => {
  if (!config.baseURL?.length) {
    Log.error("ui/request.ts", "Missing baseURL in axios request.");
  }
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
request.interceptors.response.use((response) => response.data, responseInterceptor);

export default request;
