import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node tools/generate-asvs-matrix.mjs <asvs-flat.json> <output.md>");
}

const expectedSha256 = "8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311";
const sourceBytes = await readFile(inputPath);
const actualSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error(`Unexpected ASVS source checksum: ${actualSha256}`);
}

const source = JSON.parse(sourceBytes.toString("utf8"));
const requirements = source.requirements.filter((requirement) => Number(requirement.L) <= 2);
const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const initialEvidence = new Map();
let maintainedPreamble;
try {
  const existing = await readFile(outputPath, "utf8");
  const table = existing.indexOf("| Requirement | Level | Area | Requirement text | Status | Implementation/test evidence |");
  if (table >= 0) maintainedPreamble = existing.slice(0, table).trimEnd().split("\n");
  for (const line of existing.split("\n")) {
    const match = line.match(/^\| v5\.0\.0-([^ ]+) \|.* \| (Not assessed|In progress|Passed|Not applicable|Finding) \| (.*) \|$/);
    if (match) initialEvidence.set(`V${match[1]}`, [match[2], match[3]]);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const defaultPreamble = [
  "# ASVS 5.0.0 Level 2 traceability matrix",
  "",
  "> Generated from the OWASP ASVS 5.0.0 flat JSON. Requirement text is CC BY-SA 4.0. Status and evidence are maintained in the Fylkren repository.",
  "",
  "Source revision: `v5.0.0`  ",
  "Expected SHA-256: `8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311`",
  "",
  "Status values: `Not assessed`, `In progress`, `Passed`, `Not applicable`, `Finding`.",
];
const lines = [
  ...(maintainedPreamble ?? defaultPreamble),
  "",
  "| Requirement | Level | Area | Requirement text | Status | Implementation/test evidence |",
  "| --- | ---: | --- | --- | --- | --- |",
  ...requirements.map((requirement) => {
    const [status, evidence] = initialEvidence.get(requirement.req_id) ?? ["Not assessed", "–"];
    return `| v5.0.0-${escapeCell(requirement.req_id.slice(1))} | ${requirement.L} | ${escapeCell(requirement.chapter_name)} / ${escapeCell(requirement.section_name)} | ${escapeCell(requirement.req_description)} | ${status} | ${escapeCell(evidence)} |`;
  }),
  "",
];

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Generated ${requirements.length} Level 1/2 requirements in ${outputPath}`);
