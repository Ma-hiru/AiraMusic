if (!window) {
  throw new Error("Message renderer can only be used in a browser environment.");
}

export * from "./src/renderer";
