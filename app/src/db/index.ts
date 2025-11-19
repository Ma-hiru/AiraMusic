import { tmpdir } from "node:os";
import { join } from "node:path";

const storePath = join(tmpdir(), "simple_cloud_music");

export function store() {}
