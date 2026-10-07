import { extract } from "tar";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listLogFiles, createLogArchive } from "@mahiru/app/lib/log-export";
import Fs from "node:fs/promises";

const state = vi.hoisted(() => ({ beforeArchive: vi.fn() }));
vi.mock("tar", async (importOriginal) => {
  const tar = await importOriginal<typeof import("tar")>();
  return {
    ...tar,
    create: async (...args: Parameters<typeof tar.create>) => {
      await state.beforeArchive(...args);
      return tar.create(...args);
    }
  };
});

let dir: string;
let logDir: string;

beforeEach(async () => {
  dir = await Fs.mkdtemp(join(tmpdir(), "aira-log-export-test-"));
  logDir = join(dir, "logs");
  await Fs.mkdir(logDir);
  state.beforeArchive.mockReset();
});

afterEach(async () => {
  await Fs.rm(dir, { recursive: true, force: true });
});

it("selects the newest 10 sessions or all sessions, excluding directories and other files", async () => {
  const names = Array.from(
    { length: 12 },
    (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}_10-00-00.log`
  );
  for (const name of [...names].reverse()) {
    await Fs.writeFile(join(logDir, name), name);
  }
  await Fs.writeFile(join(logDir, "other.txt"), "unrelated");
  await Fs.mkdir(join(logDir, "directory.log"));

  expect(await listLogFiles(logDir, 10)).toEqual([...names].reverse().slice(0, 10));
  expect(await listLogFiles(logDir)).toEqual([...names].reverse());
  expect(await listLogFiles(join(dir, "missing"))).toEqual([]);
});

it("archives complete snapshots with the original names while live logs continue growing", async () => {
  const files = ["2026-10-06_10-00-00.log", "2026-10-07_10-00-00.log"];
  for (const name of files) await Fs.writeFile(join(logDir, name), `日志 ${name}\n`);
  state.beforeArchive.mockImplementation(async () => {
    await Fs.appendFile(join(logDir, files[1]!), "打包期间追加\n");
  });

  const archivePath = join(dir, "export.tar.gz");
  await createLogArchive(logDir, files, archivePath);
  const outputDir = join(dir, "extracted");
  await Fs.mkdir(outputDir);
  await extract({ file: archivePath, cwd: outputDir, strict: true });

  expect((await Fs.readdir(outputDir)).sort()).toEqual(files);
  for (const name of files) {
    expect(await Fs.readFile(join(outputDir, name), "utf8")).toBe(`日志 ${name}\n`);
  }
  expect(await Fs.readFile(join(logDir, files[1]!), "utf8")).toContain("打包期间追加");
});

it("keeps an existing destination intact if archiving fails and removes temporary files", async () => {
  const name = "2026-10-07_10-00-00.log";
  await Fs.writeFile(join(logDir, name), "日志\n");
  const archivePath = join(dir, "export.tar.gz");
  await Fs.writeFile(archivePath, "previous export");
  let snapshotDir = "";
  state.beforeArchive.mockImplementation(async (options: { cwd: string }) => {
    snapshotDir = options.cwd;
    throw new Error("archive failed");
  });

  await expect(createLogArchive(logDir, [name], archivePath)).rejects.toThrow("archive failed");
  expect(await Fs.readFile(archivePath, "utf8")).toBe("previous export");
  expect(snapshotDir).not.toBe("");
  await expect(Fs.stat(snapshotDir)).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not overwrite the source log when it is selected as the destination", async () => {
  const name = "2026-10-07_10-00-00.log";
  const path = join(logDir, name);
  await Fs.writeFile(path, "original log");

  await expect(createLogArchive(logDir, [name], path)).rejects.toThrow("不能覆盖原始日志");
  expect(await Fs.readFile(path, "utf8")).toBe("original log");
});
