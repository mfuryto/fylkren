import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const excluded = new Set([".git", ".git-local", ".pnpm-store", "node_modules", "bin", "obj", "dist"]);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : markdownFiles(join(directory, entry.name));
    return entry.isFile() && entry.name.endsWith(".md") ? [join(directory, entry.name)] : [];
  });
}

const missing = [];
let checked = 0;
for (const file of markdownFiles(root)) {
  const contents = readFileSync(file, "utf8");
  for (const match of contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:|data:|codex:)/i.test(target)) continue;
    checked += 1;
    const path = resolve(dirname(file), decodeURIComponent(target));
    if (!existsSync(path)) missing.push(`${file.slice(root.length + 1)}: ${target}`);
  }
}

if (missing.length) {
  console.error(`Broken local documentation links:\n${missing.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation links passed (${checked} local targets).`);
}
