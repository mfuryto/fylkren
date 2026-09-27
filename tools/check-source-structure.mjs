import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps/api", "apps/web/src", "apps/demo/src", "shared"];
const sourceExtensions = new Set([".cs", ".css", ".ts", ".tsx"]);
const ignoredDirectories = new Set(["bin", "dist", "Migrations", "node_modules", "obj"]);
const maximumCodeLines = 500;
const maximumStyleLines = 1000;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collectSourceFiles(entryPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

const sourceFiles = (await Promise.all(roots.map(collectSourceFiles))).flat();
const oversizedFiles = [];
for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const lineCount = content === "" ? 0 : content.split(/\r?\n/).length;
  const maximumLines = path.extname(file) === ".css" ? maximumStyleLines : maximumCodeLines;
  if (lineCount > maximumLines) oversizedFiles.push({ file, lineCount, maximumLines });
}

if (oversizedFiles.length > 0) {
  console.error("Source files exceed their structural limit:");
  for (const { file, lineCount, maximumLines } of oversizedFiles.sort((a, b) => b.lineCount - a.lineCount)) {
    console.error(`- ${file}: ${lineCount} lines (maximum ${maximumLines})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Structure check passed for ${sourceFiles.length} source files (code ${maximumCodeLines}, styles ${maximumStyleLines}).`);
}
