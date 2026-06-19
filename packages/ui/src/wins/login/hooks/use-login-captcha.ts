import { NeteaseAPIAuth } from "@/common/netease/api";
import { useCallback, useEffect, useState } from "react";
import { Log } from "@/common/lib/log";
import { EqError } from "@mahiru/log";
import AppToast from "@/common/components/display/toast";

interface LoginCaptchaProps {
  /** 验证码倒计时秒数 */
  countdown?: number;
}

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
// 网易风控/安全验证返回码，会附带 redirectUrl 要求二次验证
const RISK_CONTROL_CODE = 10004;

export function useLoginCaptcha(props?: LoginCaptchaProps) {
  const { countdown: countdownSeconds = 60 } = props || {};
  const [phone, setPhone] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [cookie, setCookie] = useState<Nullable<string>>(null);

  // 验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 发送短信验证码
  const sendCaptcha = useCallback(async () => {
    if (sending || countdown > 0) return;
    if (!PHONE_PATTERN.test(phone)) {
      AppToast.show({ type: "warn", text: "请输入正确的手机号" });
      return;
    }
    setSending(true);
    try {
      const res = await NeteaseAPIAuth.sendCaptcha({ phone });
      if (res.code === 200) {
        setCountdown(countdownSeconds);
        AppToast.show({ type: "success", text: "验证码已发送" });
      } else {
        AppToast.show({ type: "error", text: res.message || "验证码发送失败" });
      }
    } catch (err) {
      Log.error({ label: "useLoginCaptcha", message: "failed to send captcha", raw: err });
      AppToast.show({ type: "error", text: "验证码发送失败，请稍后重试" });
    } finally {
      setSending(false);
    }
  }, [countdown, countdownSeconds, phone, sending]);

  // 验证码登录
  const login = useCallback(async () => {
    if (logging) return;
    if (!PHONE_PATTERN.test(phone)) {
      AppToast.show({ type: "warn", text: "请输入正确的手机号" });
      return;
    }
    if (!captcha.trim()) {
      AppToast.show({ type: "warn", text: "请输入验证码" });
      return;
    }
    setLogging(true);
    try {
      const res = await NeteaseAPIAuth.loginWithPhone({ phone, captcha: captcha.trim() });
      if (res.code === 200 && res.cookie) {
        setCookie(res.cookie);
      } else {
        AppToast.show({ type: "error", text: res.message || "登录失败，请检查验证码" });
      }
    } catch (err) {
      Log.error({ label: "useLoginCaptcha", message: "failed to login with captcha", raw: err });
      const body = resolveResponseBody(err);
      if (body?.code === RISK_CONTROL_CODE || body?.redirectUrl) {
        AppToast.show({
          type: "warn",
          text: "触发网易安全验证，请改用扫码登录或在手机 App 上完成验证"
        });
      } else {
        AppToast.show({ type: "error", text: "登录失败，请检查验证码后重试" });
      }
    } finally {
      setLogging(false);
    }
  }, [captcha, logging, phone]);

  return {
    phone,
    setPhone,
    captcha,
    setCaptcha,
    countdown,
    sending,
    logging,
    cookie,
    sendCaptcha,
    login
  };
}

interface NCMErrorBody {
  code?: number;
  message?: string;
  redirectUrl?: string;
}

// apiRequest 对非 2xx 会 reject 成 EqError，原始 axios 错误挂在 raw 上
function resolveResponseBody(err: unknown): Undefinable<NCMErrorBody> {
  const raw = EqError.isEqError(err) ? err.raw : err;
  const data = (raw as Undefinable<{ response?: { data?: NCMErrorBody } }>)?.response?.data;
  return typeof data === "object" && data !== null ? data : undefined;
}
