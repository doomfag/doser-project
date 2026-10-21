// Publish only public static distribution files; no app/user storage is read.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const files = [
  ".nojekyll",
  "icons/apple-touch-icon.png",
  "icons/icon-512.png",
  "index.html",
  "manifest.webmanifest",
  "sw.js",
].sort();
for (const file of files) {
  const s = await lstat(resolve("build-pwa", file));
  assert(
    s.isFile() && !s.isSymbolicLink(),
    "Distribution must contain regular files only",
  );
}
const temporary = await mkdtemp(join(tmpdir(), "doser-pages-index-"));
const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
const run = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", env }).trim();
try {
  const remote = run(["ls-remote", "--heads", "origin", "refs/heads/gh-pages"]);
  const parent = remote ? remote.split(/\s+/)[0] : "";
  if (parent) {
    assert(/^[a-f0-9]{40}$/.test(parent));
    run(["fetch", "--no-tags", "origin", "refs/heads/gh-pages"]);
  }
  run(["read-tree", "--empty"]);
  run([
    "--git-dir=" + resolve(run(["rev-parse", "--git-dir"])),
    "--work-tree=" + resolve("build-pwa"),
    "-C",
    resolve("build-pwa"),
    "add",
    "-f",
    "--",
    ...files,
  ]);
  const tree = run(["write-tree"]);
  assert.deepEqual(
    run(["ls-tree", "-r", "--name-only", tree]).split("\n").sort(),
    files,
  );
  if (parent && run(["rev-parse", parent + "^{tree}"]) === tree) {
    console.log("Public web files are already up to date.");
  } else {
    const author =
      process.env.GITHUB_ACTIONS === "true"
        ? [
            "-c",
            "user.name=github-actions[bot]",
            "-c",
            "user.email=41898282+github-actions[bot]@users.noreply.github.com",
          ]
        : [];
    const source = run(["rev-parse", "HEAD"]);
    const commit = run([
      ...author,
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
      "-m",
      "Publish installable Doser from " + source,
    ]);
    run(["push", "origin", commit + ":refs/heads/gh-pages"]);
    console.log(
      JSON.stringify({
        source,
        distribution: commit,
        branch: "gh-pages",
        files: files.length,
      }),
    );
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
