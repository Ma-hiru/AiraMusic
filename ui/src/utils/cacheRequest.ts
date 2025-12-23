import axios from "axios";
import { Renderer } from "@mahiru/ui/utils/renderer";

const CACHE_SERVER_BASE_URL = "/cache";
export let accessToken = "mahiru";

export const cacheRequest = axios.create({
  baseURL: CACHE_SERVER_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    Authorization: accessToken
  }
});

Renderer.invoke.storeKey(undefined).then((token) => (accessToken = token));

cacheRequest.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = accessToken;
  }
  return config;
});

cacheRequest.interceptors.response.use((response) => {
  if (response.status === 204) {
    return null;
  }
  return response.data;
});
