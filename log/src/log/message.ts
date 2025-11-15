export type Messageable = { toString: () => any } | null | undefined;

export function MessageableToString(message: Messageable): string {
  if (message && typeof message.toString === "function") {
    try {
      return String(message.toString());
    } catch (err) {
      console.error(err);
      return String(message);
    }
  }
  return String(message);
}
