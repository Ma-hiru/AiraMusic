import { typedIpcMainHandle, typedIpcMainOn } from "./typed";

export function registerIpcMainHandlers() {
  typedIpcMainOn("log", (e, data) => {
    console.log("Log event received in main:", data);
  });
  typedIpcMainHandle("message", (e, data) => {
    console.log("Message invoke received in main:", data);
    return `Received: ${data}`;
  });
}
