import { lstat, realpath, mkdir, rmdir } from "node:fs/promises";
import path from "node:path";
export async function editFolder(input: {
  protectedPaths?: string[];
  parent: string;
  name: string;
  action: "create" | "delete";
}) {
  if (
    !path.isAbsolute(input.parent) ||
    !input.name.trim() ||
    input.name !== input.name.trim() ||
    input.name === "." ||
    input.name === ".." ||
    /[\\/\x00-\x1f]/.test(input.name)
  )
    throw new Error("Invalid folder name or parent path.");
  const parent = await realpath(input.parent);
  const target = path.join(parent, input.name);
  if (input.action === "create") await mkdir(target);
  else {
    for (const protectedPath of input.protectedPaths ?? []) {
      let resolved: string;
      try {
        resolved = await realpath(protectedPath);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
      if (resolved === target)
        throw new Error(
          "This folder belongs to a project or section. Use its archive action.",
        );
    }
    const stat = await lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Only empty folders can be deleted.");
    await rmdir(target);
  }
  return { path: target };
}
