import { cx } from "@emotion/css";
import { Smartphone, ShieldCheck } from "lucide-react";
import { memo, type FC, type KeyboardEvent } from "react";

interface PhoneCaptchaProps {
  phone: string;
  captcha: string;
  logging: boolean;
  sending: boolean;
  countdown: number;
  onLogin: NormalFunc;
  onSendCaptcha: NormalFunc;
  onPhoneChange: NormalFunc<[value: string]>;
  onCaptchaChange: NormalFunc<[value: string]>;
}

const inputClass = `
  block h-9 w-full rounded-full pl-9 pr-3 text-[13px]
  border border-(--text-color)/25 bg-(--text-color)/5 text-(--text-color)
  outline-none placeholder:text-(--text-color)/45
  focus:border-primary
  ease-in-out transition-colors duration-300
`;

const PhoneCaptcha: FC<PhoneCaptchaProps> = ({
  onLogin,
  onPhoneChange,
  onSendCaptcha,
  onCaptchaChange,
  phone,
  captcha,
  logging,
  sending,
  countdown
}) => {
  const captchaDisabled = sending || countdown > 0;
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && onLogin();

  return (
    <div className="flex w-full flex-col gap-3">
      {/*手机号*/}
      <div className="relative w-full">
        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 pointer-events-none" />
        <input
          className={cx(inputClass)}
          type="tel"
          value={phone}
          maxLength={11}
          inputMode="numeric"
          placeholder="请输入手机号"
          onKeyDown={onEnter}
          onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      {/*验证码*/}
      <div className="relative w-full">
        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 pointer-events-none" />
        <input
          className={cx(inputClass, "pr-26")}
          type="text"
          maxLength={6}
          value={captcha}
          inputMode="numeric"
          placeholder="请输入验证码"
          onKeyDown={onEnter}
          onChange={(e) => onCaptchaChange(e.target.value.replace(/\D/g, ""))}
        />
        <button
          className={cx(
            `
              absolute right-1.5 top-1/2 -translate-y-1/2 h-6 rounded-full px-2.5
              text-[12px] font-medium ease-in-out transition-all duration-300
            `,
            captchaDisabled
              ? "text-(--text-color)/40 cursor-not-allowed"
              : `text-primary cursor-pointer
                 hover:bg-primary/10 active:scale-95`
          )}
          type="button"
          disabled={captchaDisabled}
          onClick={onSendCaptcha}>
          {countdown > 0 ? `${countdown}s` : sending ? "发送中" : "获取验证码"}
        </button>
      </div>

      {/*登录*/}
      <button
        className={cx(
          `
            mt-1 block h-9 w-full rounded-full text-[13px] font-semibold
            bg-primary text-(--text-color-on-main)
            ease-in-out transition-all duration-300 hover:opacity-70 active:scale-[0.98]
            cursor-pointer
          `,
          logging && "opacity-60 cursor-not-allowed active:scale-100"
        )}
        type="button"
        disabled={logging}
        onClick={onLogin}>
        {logging ? "登录中..." : "登录"}
      </button>
    </div>
  );
};

export default memo(PhoneCaptcha);
