import axios from "axios";
import HTTPConstants from "@mahiru/ui/public/constants/http";
import { EqError } from "@mahiru/log/src/err";

export const cacheRequest = axios.create({
  baseURL: HTTPConstants.CacheBaseURL,
  timeout: HTTPConstants.Timeout,
  withCredentials: true,
  headers: {
    Authorization: HTTPConstants.CacheAccessToken
  }
});

export const accessToken = HTTPConstants.CacheAccessToken;

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
