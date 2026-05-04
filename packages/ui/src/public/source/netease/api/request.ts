import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Log } from "@mahiru/ui/public/utils/dev";
import HTTPConstants from "@mahiru/ui/public/constants/http";
import AppToast from "@mahiru/ui/public/components/toast";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import { EqError } from "@mahiru/log/src/err";

export const apiRequest = axios.create({
  baseURL: HTTPConstants.NCMBaseURL,
  timeout: HTTPConstants.Timeout,
  withCredentials: true
});

type ExtendedAxiosRequestConfig = AxiosRequestConfig & {
  __retryCount?: number;
};

apiRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(
        new EqError({
          label: "apiRequest",
          message: "ncm api request canceled",
          raw: error
        })
      );
    }

    const config: Undefinable<ExtendedAxiosRequestConfig> = error?.config;
    const axiosResponse: Undefinable<AxiosResponse> = error?.response;
    const data: Undefinable<NeteaseAPI.NeteaseAPIResponse> = axiosResponse?.data;
    const message = String(data?.message || data?.msg || "");
    const method = config?.method?.toLowerCase() ?? "get";

    if (!config || !data) {
      !config && Log.warn("apiRequest.ts", "no config in error");
      !data && Log.warn("apiRequest.ts", "no response data in error");
      return Promise.reject(error);
    } else if (data.code === 301 && message.includes("需要登录")) {
      Log.warn("apiRequest.ts", "token has expired");
      AppToast.show({
        type: "info",
        text: "登录状态已过期，请重新登录"
      });
      NeteaseServices.Auth.logout().then(NeteaseServices.Auth.createLoginWindow);
    } else if (
      data.code === HTTPConstants.RetryCode &&
      // 只有在请求过于频繁且请求幂等的情况下才自动重试，否则直接报错
      message.includes(HTTPConstants.RetryMessageKeyword) &&
      HTTPConstants.IdempotentMethods.includes(method)
    ) {
      config.__retryCount ??= 0;
      if (config.__retryCount < HTTPConstants.MaxRetries) {
        const delayTime = HTTPConstants.backoff(++config.__retryCount);

        Log.trace(
          `apiRequest.ts<${config.url}>`,
          `retry ${config.__retryCount}/${HTTPConstants.MaxRetries} after ${delayTime}ms`
        );

        return delay(delayTime, <AbortSignal>config.signal)
          .then(() => apiRequest(config))
          .catch(() => error);
      }
    }

    return Promise.reject(
      new EqError({
        label: "apiRequest",
        message: `ncm api request failed: ${data.code} ${data.message}`,
        raw: error
      })
    );
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
          reject();
        },
        { once: true, passive: true }
      );
    }
  });
}
