import axios from "axios";
import { Renderer } from "@mahiru/ui/utils/renderer";

export const accessToken = await new Promise<string>((resolve) => {
  Renderer.invoke
    .storeKey()
    .then((token) => resolve(token))
    .catch(() => resolve("mahiru"));
});

export const cacheRequest = axios.create({
  baseURL: "/cache",
  withCredentials: true,
  timeout: 15000,
  headers: {
    Authorization: accessToken
  }
});

cacheRequest.interceptors.response.use((response) => {
  return response.status === 204 ? null : response.data;
});
