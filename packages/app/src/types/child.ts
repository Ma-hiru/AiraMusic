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

export type MainChildControlMessage = { type: "stop" } | MainChildStartMessage;

export type MainChildSerializedError = {
  stack?: string;
  message: string;
};
