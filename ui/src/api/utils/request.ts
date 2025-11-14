import { doLogout } from "./auth";
import axios, { AxiosResponse } from "axios";

let baseURL = "";
// TODO: Check process.env.IS_ELECTRON
if (process.env.NODE_ENV === "production") {
  baseURL = process.env.VUE_APP_ELECTRON_API_URL!;
} else {
  baseURL = process.env.VUE_APP_ELECTRON_API_URL_DEV!;
}

const service = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000
});

service.interceptors.request.use((config) => {
  config.params ||= {};
  if (!baseURL.length) {
    console.error("You must set up the baseURL in the service's config");
  }
  // Force real_ip
  const settings = localStorage.getItem("settings");
  if (settings) {
    const parsedSettings = JSON.parse(settings);
    const enableRealIP = parsedSettings.enableRealIP;
    const realIP = parsedSettings.realIP;
    const proxy = parsedSettings.proxyConfig;

    enableRealIP && (config.params.realIP = realIP);
    if (["HTTP", "HTTPS"].includes(proxy.protocol)) {
      config.params.proxy = `${proxy.protocol}://${proxy.server}:${proxy.port}`;
    }
  }

  return config;
});

service.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    let response: AxiosResponse | null = null;
    let data;

    if (error === "TypeError: baseURL is undefined") {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (error.response) {
      response = error.response;
      data = response?.data;
    }

    if (response && typeof data === "object" && data.code === 301 && data.msg === "需要登录") {
      console.warn("Token has expired. Logout now!");
      // 登出帳戶
      doLogout();
      // 導向登入頁面
      //TODO
    }
  }
);

export default service;
