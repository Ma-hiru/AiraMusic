import { cx } from "@emotion/css";
import { useMemo, type ReactNode } from "react";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";

import AppModal from "./use";

export function createDialogModal({
  onCancel,
  onConfirm,
  onConfirmCancel,
  body,
  title,
  width,
  footer,
  height,
  important,
  cancelText,
  confirmText,
  footerExtraElement
}: {
  title: string;
  width?: number;
  body: ReactNode;
  height?: number;
  footer?: ReactNode;
  cancelText?: string;
  important?: boolean;
  confirmText?: string;
  onCancel?: NormalFunc;
  onConfirm?: NormalFunc;
  onConfirmCancel?: NormalFunc;
  footerExtraElement?: ReactNode;
}): ModalRender {
  return {
    title,
    content: (
      <Dialog
        body={body}
        footer={footer}
        important={important}
        cancelText={cancelText}
        confirmText={confirmText}
        footerExtraElement={footerExtraElement}
        onConfirm={onConfirm}
        onConfirmCancel={onConfirmCancel}
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
  onConfirmCancel,
  body,
  footer,
  important,
  cancelText,
  confirmText,
  footerExtraElement
}: {
  body?: ReactNode;
  footer?: ReactNode;
  cancelText?: string;
  important?: boolean;
  confirmText?: string;
  onConfirm?: NormalFunc;
  onConfirmCancel?: NormalFunc;
  footerExtraElement?: ReactNode;
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
          className="
            px-2.5 py-1 rounded-md cursor-pointer text-sm
            transition-all ease-in-out duration-300
            active:scale-96 hover:opacity-50
          "
          onClick={() => {
            onConfirmCancel?.();
            AppModal.close();
          }}>
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
