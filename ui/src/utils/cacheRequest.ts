import axios from "axios";

const CACHE_SERVER_BASE_URL = "/cache";

export const cacheRequest = axios.create({
  baseURL: CACHE_SERVER_BASE_URL,
  withCredentials: true,
  timeout: 15000
});

cacheRequest.interceptors.response.use((response) => {
  if (response.status === 204) {
    return null;
  }
  return response.data;
});
