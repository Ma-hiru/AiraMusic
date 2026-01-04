import axios from "axios";
import { Auth } from "./auth";
import { Log } from "@mahiru/ui/utils/dev";
import { waitLogin } from "@mahiru/ui/hook/useLogout";

// 开发模式通过vite代理访问API服务器地址
// 生产模式通过express代理访问API服务器地址
export const apiRequest = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000
});

apiRequest.interceptors.response.use(
  (response) => response.data,
  async (error: any) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const config = error.config;
    const axiosResponse = error?.response;
    const data = axiosResponse?.data as NeteaseAPIResponse;

    if (data?.code === 301 && data?.msg === "需要登录") {
      Log.warn("apiRequest.ts", "token has expired");
      Auth.doLogout().finally(waitLogin);
      return Promise.reject(error);
    } else if (
      data?.code === 405 &&
      (data?.message === "操作频繁，请稍候再试" || data?.msg === "操作频繁，请稍候再试")
    ) {
      const method = config.method?.toLowerCase();
      const isIdempotent = ["get", "head", "options"].includes(method);
      if (!isIdempotent) {
        return Promise.reject(error);
      }

      config.__retryCount ??= 0;
      config.__maxRetries ??= 3;
      config.__retryDelay ??= 1000;
      // 请求过于频繁，自动延迟重试
      if (config.__retryCount < config.__maxRetries) {
        config.__retryCount++;
        const base = config.__retryDelay;
        const cap = 30_000;
        const exp = Math.min(cap, base * 2 ** (config.__retryCount - 1));
        const delayTime = Math.random() * exp;

        Log.warn(
          "apiRequest.ts",
          `retry ${config.__retryCount}/${config.__maxRetries} after ${delayTime}ms`
        );
        await delay(delayTime, config.signal);
        return apiRequest(config);
      }
    }

    return Promise.reject(error);
  }
);

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );
    }
  });
}
