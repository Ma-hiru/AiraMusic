import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { clamp } from "lodash-es";

export const accessToken = await Renderer.invoke.storeKey().catch(() => "mahiru");

export default class HTTPConstants {
  /**
   * 开发模式通过vite代理访问API服务器地址 \
   * 生产模式通过express代理访问API服务器地址
   * */
  static readonly NCMBaseURL = "/api";
  static readonly CacheBaseURL = "/cache";
  static readonly CacheAccessToken = accessToken;
  static readonly Timeout = 15 * 1000;
  /** 不会修改服务器状态的 HTTP 方法，重试时仅重试这些方法(幂等) */
  static readonly IdempotentMethods = ["get", "head", "options"];
  /** 基础重试延迟，单位毫秒 */
  static readonly RetryDelay = 1000;
  /** 最大重试延迟，单位毫秒 */
  static readonly MaxRetryDelay = 30_000;
  /** 触发重试的 HTTP 状态码 */
  static readonly RetryCode = 405;
  /** 触发重试的响应消息关键词 */
  static readonly RetryMessageKeyword = "频繁";
  /** 最大重试次数 */
  static readonly MaxRetries = 3;

  /** 指数退避算法 */
  static backoff(retryCount: number) {
    return (
      Math.random() *
      clamp(
        HTTPConstants.RetryDelay * 2 ** (retryCount - 1),
        HTTPConstants.RetryDelay,
        HTTPConstants.MaxRetryDelay
      )
    );
  }
}
