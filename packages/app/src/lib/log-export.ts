import { create } from "tar";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Fs from "node:fs/promises";

export async function listLogFiles(dir: string, limit?: number) {
  try {
    const entries = await Fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    return limit === undefined ? files : files.slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function createLogArchive(dir: string, files: string[], filePath: string) {
  if (files.some((name) => resolve(dir, name) === resolve(filePath))) {
    throw new Error("保存位置不能覆盖原始日志");
  }

  const snapshotDir = await Fs.mkdtemp(join(tmpdir(), "aira-music-logs-"));
  try {
    // 当前日志仍在追加，先复制快照，避免归档时文件大小发生变化。
    for (const name of files) {
      await Fs.copyFile(join(dir, name), join(snapshotDir, name));
    }
    const archivePath = join(snapshotDir, "logs.tar.gz");
    await create(
      { cwd: snapshotDir, file: archivePath, gzip: true, portable: true, strict: true },
      files.map((name) => `./${name}`)
    );
    await Fs.copyFile(archivePath, filePath);
  } finally {
    await Fs.rm(snapshotDir, { recursive: true, force: true });
  }
}
