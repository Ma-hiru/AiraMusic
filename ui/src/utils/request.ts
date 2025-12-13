import axios, { AxiosResponse } from "axios";
import { Auth } from "./auth";
import { Log } from "@mahiru/ui/utils/dev";
import { waitLogin } from "@mahiru/ui/hook/useLogout";

// 开发模式通过vite代理访问API服务器地址
// 生产模式通过express代理访问API服务器地址
const NETEASE_API_BASE_URL = "/api";

export const apiRequest = axios.create({
  baseURL: NETEASE_API_BASE_URL,
  withCredentials: true,
  timeout: 15000
});

apiRequest.interceptors.request.use((config) => {
  if (!config.baseURL?.length) {
    Log.error("ui/request.ts", "Missing baseURL in axios request.");
  }
  return config;
});

apiRequest.interceptors.response.use(
  (response) => response.data,
  async (error: any) => {
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
      Auth.doLogout().finally(waitLogin);
    }

    return Promise.reject(error);
  }
);
