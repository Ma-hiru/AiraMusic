import { type ReactNode, useMemo } from "react";
import AppModal from "./use";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";

export function createDialogModal({
  title,
  body,
  footer,
  onCancel,
  onConfirm,
  width,
  height
}: {
  title: string;
  body: ReactNode;
  footer: ReactNode;
  onConfirm: Undefinable<NormalFunc>;
  onCancel?: NormalFunc;
  width?: number;
  height?: number;
}): ModalRender {
  return {
    title,
    content: <Dialog body={body} footer={footer} onConfirm={onConfirm} />,
    onClose: onCancel,
    width: width ?? 400,
    height
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const Dialog = ({
  onConfirm,
  body,
  footer
}: {
  onConfirm?: NormalFunc;
  body?: ReactNode;
  footer?: ReactNode;
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
          className={`
            px-2.5 py-1 rounded-md cursor-pointer text-sm
            hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
            transition-all ease-in-out duration-300
            active:scale-96
          `}
          onClick={() => {
            onConfirm?.();
            AppModal.close();
          }}>
          确认
        </button>
      </footer>
    );
  }, [footer, onConfirm]);

  return (
    <section className="w-full h-full">
      {renderBody}
      {renderFooter}
    </section>
  );
};
