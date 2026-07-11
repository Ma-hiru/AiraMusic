import { MemoryCache } from "./memory";
import { BrowserCache } from "./browser";
import { Local, LocalSatisfiesInterface } from "./local";

const browser = new BrowserCache();
const memory = new MemoryCache();
const local = new LocalSatisfiesInterface();

export class RendererCache {
  static readonly browser = browser;
  static readonly memory = memory;
  static readonly local = local;
  static readonly service = Local;
}
