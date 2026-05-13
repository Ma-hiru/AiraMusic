if (!process) {
  throw new Error("Message main can only be used in a Node.js environment.");
}

export * from "./src/main";
