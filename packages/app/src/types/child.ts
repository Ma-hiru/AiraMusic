export type MainChildParentPort<
  ParentMessage extends { type: string },
  ChildMessage extends { type: string }
> = {
  on(
    event: "message",
    listener: (event: { data: ParentMessage }) => void
  ): MainChildParentPort<ParentMessage, ChildMessage>;

  postMessage(message: ChildMessage): void;
};

export type MainChildStartMessage = { type: "start" };

export type MainChildControlMessage = MainChildStartMessage | { type: "stop" };

export type MainChildSerializedError = {
  message: string;
  stack?: string;
};
