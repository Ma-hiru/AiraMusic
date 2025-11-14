import { doLogout } from "./auth";
import axios, { AxiosResponse } from "axios";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { EqError } from "@mahiru/ui/utils/err";

const NETEASE_API_BASE_URL = "http://127.0.0.1:10754";

if (!NETEASE_API_BASE_URL) {
  EqError.printErrorDEV("[api/request]", "Missing API base URL.");
}

const service = axios.create({
  baseURL: NETEASE_API_BASE_URL,
  withCredentials: true,
  timeout: 15000
});

service.interceptors.request.use((config) => {
  config.params ||= {};

  if (!config.baseURL?.length) {
    EqError.printErrorDEV("[api/request]", "Missing baseURL.");
  }

  const { settings } = usePersistZustandStore.getState();
  if (settings.enableRealIP && settings.realIP) {
    config.params.realIP ??= settings.realIP;
  }

  const proxy = settings.proxyConfig;
  const protocol = proxy?.protocol?.toUpperCase();
  if (protocol && ["HTTP", "HTTPS"].includes(protocol) && proxy.server && proxy.port) {
    config.params.proxy = `${protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const axiosResponse: AxiosResponse | undefined = error?.response;
    const data = axiosResponse?.data;

    if (!axiosResponse && typeof error?.message === "string" && error.message.includes("baseURL")) {
      console.error("You must set up the baseURL in the service's config");
    }

    if (
      axiosResponse &&
      typeof data === "object" &&
      data !== null &&
      (data as { code?: number; msg?: string }).code === 301 &&
      (data as { code?: number; msg?: string }).msg === "需要登录"
    ) {
      EqError.printDEV("[api/request]", "Token has expired. Logout now!");
      doLogout();
      //TODO: router redirect to login page
    }

    return Promise.reject(error);
  }
);

export default service;
