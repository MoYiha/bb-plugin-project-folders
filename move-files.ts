import { lstat, realpath, rename, symlink, readlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
export const within = (p: string, root: string) =>
  p === root || p.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
async function stat(p: string) {
  try {
    return await lstat(p);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function inspectMove(input: {
  source: string;
  destination: string;
}) {
  if (process.platform === "win32")
    throw new Error(
      "Project relocation currently supports macOS and Linux only.",
    );
  const source = path.resolve(input.source),
    destination = path.resolve(input.destination);
  if (
    !path.isAbsolute(input.source) ||
    !path.isAbsolute(input.destination) ||
    /[\x00-\x1f]/.test(source + destination)
  )
    throw new Error("Choose absolute folder paths.");
  if (within(destination, source) || within(source, destination))
    throw new Error("Source and destination must not contain each other.");
  const src = await stat(source),
    dst = await stat(destination);
  const parent = await realpath(path.dirname(destination));
  if (parent !== path.dirname(destination))
    throw new Error("Choose a destination without symbolic-link parents.");
  if (
    src?.isSymbolicLink() &&
    dst?.isDirectory() &&
    (await readlink(source)) === destination
  )
    return { source, destination, moved: true };
  if (!src?.isDirectory() || src.isSymbolicLink())
    throw new Error("The source must be an existing real project directory.");
  if ((await realpath(source)) !== source)
    throw new Error("Choose a source without symbolic-link parents.");
  const home = await realpath(os.homedir());
  for (const protectedPath of [
    home,
    process.cwd(),
    path.join(home, ".bb"),
    path.join(home, ".bb-machines"),
  ])
    if (within(protectedPath, source))
      throw new Error(
        "The home folder or a directory containing BB runtime data cannot be moved.",
      );
  if (dst)
    throw new Error(
      "The destination already exists. Choose a new folder name; folders are never merged or overwritten.",
    );
  const parentStat = await lstat(parent);
  if (src.dev !== parentStat.dev)
    throw new Error(
      "Choose a folder on the same disk volume. Cross-volume relocation is not supported yet.",
    );
  // A linked worktree needs git worktree repair and its external repository; do not move it implicitly.
  if ((await stat(path.join(source, ".git")))?.isFile())
    throw new Error(
      "Linked Git worktrees must be moved with Git worktree tools.",
    );
  return { source, destination, moved: false };
}
export async function moveDirectory(input: {
  source: string;
  destination: string;
}) {
  const plan = await inspectMove(input);
  if (plan.moved) return plan;
  // rename is same-volume; all files, including dotfiles and internal symlinks, move together.
  await rename(plan.source, plan.destination);
  try {
    await symlink(plan.destination, plan.source, "dir");
  } catch (e) {
    // Do not undo over a path another process has created.
    if (!(await stat(plan.source))) await rename(plan.destination, plan.source);
    throw new Error(
      "Could not create the compatibility link. Inspect the source and destination before retrying.",
    );
  }
  return { ...plan, moved: true };
}
