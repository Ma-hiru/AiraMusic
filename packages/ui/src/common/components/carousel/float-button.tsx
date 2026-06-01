import { type FC, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface FloatButtonProps {
  next: NormalFunc;
  prev: NormalFunc;
}

const FloatButton: FC<FloatButtonProps> = ({ next, prev }) => {
  return (
    <>
      <button
        title="上一张"
        className="
          absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer
          items-center justify-center rounded-full bg-black/35 text-white shadow-md
          backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-black/55
          active:scale-90
        "
        onClick={prev}>
        <ChevronLeft className="size-5" />
      </button>
      <button
        title="下一张"
        className="
          absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer
          items-center justify-center rounded-full bg-black/35 text-white shadow-md
          backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-black/55
          active:scale-90
        "
        onClick={next}>
        <ChevronRight className="size-5" />
      </button>
    </>
  );
};

export default memo(FloatButton);
