import { MainEntry, MainApp } from "@/entry";

// 创建程序实例
const app = new MainApp();
// 创建入口实例
const entry = new MainEntry(app);
// 进入，多实例会退出
entry.tryRun();
