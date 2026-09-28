import { readFile } from "node:fs/promises";

const version = (await readFile("VERSION", "utf8")).trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
  throw new Error(`VERSION is not valid Semantic Versioning: ${version}`);

const props = await readFile("Directory.Build.props", "utf8");
if (!props.includes(`<Version>${version}</Version>`))
  throw new Error(`Directory.Build.props does not use VERSION ${version}.`);

const readme = await readFile("README.md", "utf8");
if (!readme.includes(`<code>VERSION ${version}</code>`))
  throw new Error(`README.md does not display VERSION ${version}.`);

console.log(`Version consistency passed (${version}).`);
