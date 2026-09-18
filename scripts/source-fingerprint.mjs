import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * A short, deterministic id for the exact source a build was made from.
 *
 * Coolify passes no commit id into the build and its checkout carries no .git,
 * so the source itself is the only thing both sides can agree on: hash the
 * files that go into the app, and the same checkout always produces the same
 * value. Compare what /api/version reports with `npm run fingerprint` here and
 * you know whether production is running this code — no platform support, no
 * credentials.
 */
const ROOTS = ["src", "prisma", "public", "package-lock.json", "package.json", "next.config.ts"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function walk(path, out) {
  let info;
  try {
    info = statSync(path);
  } catch {
    return;
  }
  if (info.isDirectory()) {
    for (const entry of readdirSync(path).sort()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith("._")) continue;
      walk(join(path, entry), out);
    }
    return;
  }
  out.push(path);
}

export function sourceFingerprint(cwd = process.cwd()) {
  const files = [];
  for (const root of ROOTS) walk(join(cwd, root), files);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    // Path first so a rename changes the result, then the bytes.
    hash.update(relative(cwd, file).split(sep).join("/"));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 12);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  console.log(sourceFingerprint());
}
