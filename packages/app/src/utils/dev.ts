import { randomUUID } from "node:crypto";

export const storeKeyAccessToken = `${process.env.APP_NAME}-access-token-${randomUUID()}`;

export const runtimeID = `${process.env.APP_NAME}-runtime-${randomUUID()}`;

export const isDev = process.env.APP_MODE.toLowerCase().includes("dev");
