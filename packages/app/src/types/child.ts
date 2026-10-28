export interface Message {
  type: string;
}

export interface StartMessage extends Message {
  type: "start";
}

export interface StopMessage extends Message {
  type: "stop";
}
export interface StoppedMessage extends Message {
  type: "stopped";
}

export interface ReadyMessage extends Message {
  type: "ready";
}

export interface ErrorMessage extends Message {
  type: "error";
  error: SerializedError;
}

export type ControlMessage = StopMessage | StartMessage;

export type ResultMessage = ErrorMessage | ReadyMessage | StoppedMessage;

export interface ParentPort<
  ParentMessage extends Message = Message,
  ChildMessage extends Message = Message
>
  extends Electron.ParentPort {
  postMessage(message: ChildMessage): void;
  on(
    event: "message",
    listener: (event: { data: ParentMessage; ports: Electron.MessagePortMain[] }) => void
  ): this;
}

export interface SerializedError extends Partial<Error> {
  message: string;
  name?: string | "panic";
}
