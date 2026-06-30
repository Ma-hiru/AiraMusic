import { cx } from "@emotion/css";
import { type ReactNode, useMemo } from "react";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";
import AppModal from "./use";

export function createDialogModal({
  title,
  body,
  footer,
  onCancel,
  onConfirm,
  width,
  height,
  important,
  onConfirmCancel,
  cancelText,
  confirmText,
  footerExtraElement
}: {
  title: string;
  body: ReactNode;
  footerExtraElement?: ReactNode;
  footer?: ReactNode;
  onConfirm?: NormalFunc;
  confirmText?: string;
  cancelText?: string;
  onConfirmCancel?: NormalFunc;
  onCancel?: NormalFunc;
  width?: number;
  height?: number;
  important?: boolean;
}): ModalRender {
  return {
    title,
    content: (
      <Dialog
        body={body}
        footer={footer}
        onConfirm={onConfirm}
        cancelText={cancelText}
        confirmText={confirmText}
        onConfirmCancel={onConfirmCancel}
        important={important}
        footerExtraElement={footerExtraElement}
      />
    ),
    onClose: onCancel,
    width: width ?? 400,
    height
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const Dialog = ({
  onConfirm,
  body,
  footer,
  important,
  onConfirmCancel,
  footerExtraElement,
  cancelText,
  confirmText
}: {
  onConfirm?: NormalFunc;
  body?: ReactNode;
  footer?: ReactNode;
  important?: boolean;
  onConfirmCancel?: NormalFunc;
  footerExtraElement?: ReactNode;
  confirmText?: string;
  cancelText?: string;
}) => {
  const renderBody = useMemo(() => {
    if (typeof body !== "string") return body;
    return (
      <p className="line-clamp-5 text-base tracking-normal leading-normal font-normal">{body}</p>
    );
  }, [body]);

  const renderFooter = useMemo(() => {
    if (footer) return footer;

    return (
      <footer className="w-full flex flex-row justify-end items-center gap-2 mt-3">
        {footerExtraElement}
        <button
          onClick={() => {
            onConfirmCancel?.();
            AppModal.close();
          }}
          className="
            px-2.5 py-1 rounded-md cursor-pointer text-sm
            transition-all ease-in-out duration-300
            active:scale-96 hover:opacity-50
          ">
          {cancelText ?? "取消"}
        </button>
        <button
          className={cx(
            `
            px-2.5 py-1 rounded-md cursor-pointer text-sm
            transition-all ease-in-out duration-300
            active:scale-96
          `,
            important
              ? "bg-red-500/80 text-white hover:opacity-50"
              : "hover:bg-primary hover:text-primary-text"
          )}
          onClick={() => {
            onConfirm?.();
            AppModal.close();
          }}>
          {confirmText ?? "确定"}
        </button>
      </footer>
    );
  }, [cancelText, confirmText, footer, footerExtraElement, important, onConfirm, onConfirmCancel]);

  return (
    <section className="w-full h-full">
      {renderBody}
      {renderFooter}
    </section>
  );
};
