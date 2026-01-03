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
  (response) => {
    if (response?.data?.code !== 200) {
      Log.error(
        "apiRequest.ts",
        response.data.msg ||
          response.data.message ||
          `API responded with error code: ${response.data.code}`
      );
      return Promise.reject(response);
    }
    return response.data;
  },
  async (error: any) => {
    const axiosResponse = error?.response;
    const data = axiosResponse?.data as NeteaseAPIResponse;

    if (data?.code === 301 && data?.msg === "需要登录") {
      Log.warn("apiRequest.ts", "token has expired");
      Auth.doLogout().finally(waitLogin);
    }

    return Promise.reject(error);
  }
);
