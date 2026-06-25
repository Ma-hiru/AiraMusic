import { type ReactNode, useMemo } from "react";
import AppModal from "./use";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";
import { cx } from "@emotion/css";

export function createDialogModal({
  title,
  body,
  footer,
  onCancel,
  onConfirm,
  width,
  height,
  important
}: {
  title: string;
  body: ReactNode;
  footer: ReactNode;
  onConfirm: Undefinable<NormalFunc>;
  onCancel?: NormalFunc;
  width?: number;
  height?: number;
  important?: boolean;
}): ModalRender {
  return {
    title,
    content: <Dialog body={body} footer={footer} onConfirm={onConfirm} important={important} />,
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
  important
}: {
  onConfirm?: NormalFunc;
  body?: ReactNode;
  footer?: ReactNode;
  important?: boolean;
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
        <button
          className={cx(
            `
            px-2.5 py-1 rounded-md cursor-pointer text-sm
            transition-all ease-in-out duration-300
            active:scale-96
          `,
            important
              ? "bg-red-500/80 text-white hover:opacity-50"
              : "hover:bg-primary hover:text-(--text-color-on-main)"
          )}
          onClick={() => {
            onConfirm?.();
            AppModal.close();
          }}>
          确认
        </button>
      </footer>
    );
  }, [footer, important, onConfirm]);

  return (
    <section className="w-full h-full">
      {renderBody}
      {renderFooter}
    </section>
  );
};
