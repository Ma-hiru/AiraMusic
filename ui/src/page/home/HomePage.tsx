import { FC, memo } from "react";

const HomePage: FC<object> = () => {
  return (
    <div className="w-screen h-screen flex justify-center items-center bg-black text-md font-mono text-white">
      Home Page
    </div>
  );
};

export default memo(HomePage);
