import { MainHandle } from "@/lib/handle";
import { MainApp, MainEntry } from "@/entry";

// 创建程序实例
const app = new MainApp();
// 创建入口实例
const entry = new MainEntry(app);
// 保存程序实例
MainHandle.save(app);
// 进入，多实例会退出
entry.tryRun();
