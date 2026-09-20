import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  githubRemotes,
  githubUrlForPath,
  parseGithubRemote,
} from "./github-remote";

const roots: string[] = [];
async function root() {
  const p = await mkdtemp(path.join(tmpdir(), "bb-github-remote-"));
  roots.push(p);
  return p;
}
afterEach(async () => {
  for (const p of roots.splice(0)) await rm(p, { recursive: true, force: true });
});

it("normalizes GitHub https, ssh and .git suffixes", () => {
  expect(parseGithubRemote("https://github.com/VKirill/bb-plugin-project-folders.git")).toBe(
    "https://github.com/VKirill/bb-plugin-project-folders",
  );
  expect(parseGithubRemote("https://github.com/acme/demo")).toBe(
    "https://github.com/acme/demo",
  );
  expect(parseGithubRemote("git@github.com:acme/demo.git")).toBe(
    "https://github.com/acme/demo",
  );
  expect(parseGithubRemote("ssh://git@github.com/acme/demo")).toBe(
    "https://github.com/acme/demo",
  );
  expect(parseGithubRemote("ssh://github.com/acme/demo.git")).toBe(
    "https://github.com/acme/demo",
  );
});

it("rejects non-GitHub remotes and junk", () => {
  expect(parseGithubRemote("https://gitlab.com/acme/demo.git")).toBeNull();
  expect(parseGithubRemote("git@gitlab.com:acme/demo.git")).toBeNull();
  expect(parseGithubRemote("not a remote")).toBeNull();
  expect(parseGithubRemote("")).toBeNull();
  expect(parseGithubRemote(null)).toBeNull();
  expect(parseGithubRemote("https://github.com.evil/acme/demo")).toBeNull();
});

it("reads origin from a folder with a GitHub remote and skips missing git", async () => {
  const withOrigin = await root();
  await mkdir(path.join(withOrigin, ".git"));
  await writeFile(
    path.join(withOrigin, ".git", "config"),
    `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = git@github.com:VKirill/demo.git\n`,
  );
  const bare = await root();
  await mkdir(path.join(bare, ".git"));
  await writeFile(
    path.join(bare, ".git", "config"),
    `[core]\n\trepositoryformatversion = 0\n`,
  );
  const missing = await root();
  const worktree = await root();
  await writeFile(
    path.join(worktree, ".git"),
    `gitdir: ${path.join(withOrigin, ".git")}\n`,
  );
  const { remotes } = await githubRemotes({
    paths: [withOrigin, bare, missing, worktree],
  });
  expect(remotes).toEqual([
    { path: withOrigin, url: "https://github.com/VKirill/demo" },
    { path: bare, url: null },
    { path: missing, url: null },
    { path: worktree, url: "https://github.com/VKirill/demo" },
  ]);
  expect(await githubUrlForPath(missing)).toBeNull();
});
