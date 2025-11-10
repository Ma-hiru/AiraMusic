import { app, BrowserWindow } from "electron";
import { isDev } from "@/utils/dev";
import { appPathJoin } from "@/utils/path";

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    title: "test",
    width: 800,
    height: 600
  });
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(appPathJoin("dist-ui", "index.html"));
  }
});
