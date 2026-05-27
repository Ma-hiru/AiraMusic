import { MainApp } from "@/entry";

export class MainHandle {
  private static app: Nullable<Readonly<MainApp>> = null;

  static save(instance: Readonly<MainApp>) {
    MainHandle.app = instance;
  }

  static get() {
    return MainHandle.app;
  }
}
