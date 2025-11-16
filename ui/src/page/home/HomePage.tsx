import { FC, memo } from "react";

const HomePage: FC<object> = () => {
  return (
    <div className="w-screen h-screen flex  flex-col justify-center items-center bg-black text-md font-mono text-white">
      Home Page
      <button
        className="border bg-white text-black px-2 py-1 rounded-md font-mono"
        onClick={() => {
          window.node.event.createLoginWindow();
        }}>
        create login window
      </button>
    </div>
  );
};

export default memo(HomePage);
