import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Control: FC<object> = () => {
  const { play, mute, upVolume, downVolume } = usePlayer();
  return (
    <div className="space-x-2">
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.invoke.message("hello from renderer").then((response) => {
            console.log(response);
          });
        }}>
        send message
      </button>
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.event.createLoginWindow();
        }}>
        login
      </button>
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.event.close("main");
        }}>
        close
      </button>
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.event.minimize("main");
        }}>
        min
      </button>
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.event.maximize("main");
        }}>
        max
      </button>
      <button
        className="px-2 py-1 rounded-lg bg-white/50"
        onClick={() => {
          window.node.event.unmaximize("main");
        }}>
        unmax
      </button>
      <button onClick={play} className="px-2 py-1 rounded-lg bg-white/50">
        play
      </button>
      <button onClick={mute} className="px-2 py-1 rounded-lg bg-white/50">
        mute
      </button>
      <button onClick={() => upVolume(0.1)} className="px-2 py-1 rounded-lg bg-white/50">
        volume +
      </button>
      <button onClick={() => downVolume(0.1)} className="px-2 py-1 rounded-lg bg-white/50">
        volume -
      </button>
    </div>
  );
};
export default memo(Control);
