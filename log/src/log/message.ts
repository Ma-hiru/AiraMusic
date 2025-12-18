export type Messageable = { toString: () => any } | null | undefined | object;

export function MessageableToString(message: Messageable): string {
  if (message && typeof message === "object") {
    if (message instanceof Error) return message.stack || message.message;
    if (typeof message.toString === "function" && message.toString !== Object.prototype.toString) {
      try {
        return String(message.toString());
      } catch (err) {
        console.error(err);
      }
    }
    try {
      return JSON.stringify(message, null, 2);
    } catch (err) {
      console.error(err);
      return String(message);
    }
  }
  return String(message);
}
