import { EqError } from "@mahiru/log";
import { RendererRuntime } from "@/common/lib/runtime";
import axios from "axios";
import RendererHTTPConstants from "@/common/constants/http";

export const cacheRequest = axios.create({
  baseURL: RendererHTTPConstants.CacheBaseURL,
  timeout: RendererHTTPConstants.Timeout,
  withCredentials: true,
  headers: {
    Authorization: RendererRuntime.cacheAccessToken
  }
});

export const accessToken = RendererRuntime.cacheAccessToken;

cacheRequest.interceptors.response.use(
  (response) => {
    return response.status === 204 ? null : response.data;
  },
  (error) => {
    return Promise.reject(
      new EqError({
        label: "cacheRequest",
        message: "cache api request failed",
        raw: error
      })
    );
  }
);
