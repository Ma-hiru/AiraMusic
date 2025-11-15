export const isWindows = process.platform === "win32";
export const isMacOS = process.platform === "darwin";
export const isLinux = process.platform === "linux";

// 是否创建系统托盘图标
export const isCreateTray = isWindows || isLinux;
// 是否创建 MPRIS 支持
export const isCreateMpris = isLinux;
