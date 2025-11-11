import { StrictMode } from "react";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";

export default function App() {
  const update = useUpdate();
  return (
    <StrictMode>
      <div className="w-screen h-screen bg-black flex justify-center items-center font-mono text-white text-lg flex-col gap-2">
        {update.count}
        <button
          className="border bg-white text-black font-mono hover:bg-gray-500/60 active:bg-gray-500/40 select-none text-sm px-2 py-1 rounded"
          onClick={update}>
          Update
        </button>
      </div>
    </StrictMode>
  );
}
