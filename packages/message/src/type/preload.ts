import { Message, MessageDirection } from "./message";

export type ExtendedMessageChannelAPI = {
  _message: {
    send: NormalFunc<[message: Message<any, MessageDirection["send"]>]>;
    listen: (cb: NormalFunc<[data: Message<any, MessageDirection["receive"]>]>) => void;
  };
};
