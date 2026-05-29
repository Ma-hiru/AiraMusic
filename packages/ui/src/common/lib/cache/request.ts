import axios from "axios";
import RendererHTTPConstants from "@/common/constants/http";
import { EqError } from "@mahiru/log";

export const cacheRequest = axios.create({
  baseURL: RendererHTTPConstants.CacheBaseURL,
  timeout: RendererHTTPConstants.Timeout,
  withCredentials: true,
  headers: {
    Authorization: RendererHTTPConstants.CacheAccessToken
  }
});

export const accessToken = RendererHTTPConstants.CacheAccessToken;

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
