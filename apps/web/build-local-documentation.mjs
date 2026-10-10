import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(webRoot, '../..');
const documentationRoot = path.join(repositoryRoot, 'docs');
const outputRoot = path.join(webRoot, '.generated-public', 'documentation');
const repositoryDocuments = ['README.md', 'CHANGELOG.md', 'SECURITY.md', 'NOTICE.md', 'TRADEMARKS.md'];
const version = (await readFile(path.join(repositoryRoot, 'VERSION'), 'utf8')).trim();

const escapeHtml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const slug = value => value
  .replace(/<[^>]+>/g, '')
  .toLocaleLowerCase('en-US')
  .replace(/[^\p{L}\p{N}\s_-]/gu, '')
  .trim()
  .replace(/\s/g, '-');

function outputForSource(source) {
  const relative = path.relative(documentationRoot, source);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    if (relative === 'README.md') return path.join(outputRoot, 'index.html');
    return path.join(outputRoot, relative.replace(/\.md$/i, '.html'));
  }
  if (path.dirname(source) === repositoryRoot && repositoryDocuments.includes(path.basename(source)))
    return path.join(outputRoot, 'repository', path.basename(source).replace(/\.md$/i, '.html'));
  return undefined;
}

function localLink(source, output, href) {
  if (!href || /^(?:[a-z]+:|#|\/)/i.test(href)) return href;
  const [file, fragment] = href.split('#', 2);
  if (!file.toLocaleLowerCase().endsWith('.md')) return href;
  const target = outputForSource(path.resolve(path.dirname(source), decodeURIComponent(file)));
  if (!target) return href;
  const relative = path.relative(path.dirname(output), target).split(path.sep).join('/');
  return `${relative || path.basename(target)}${fragment ? `#${fragment}` : ''}`;
}

function pageTemplate(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)} · Fylkren ${escapeHtml(version)}</title>
  <link rel="stylesheet" href="/documentation/documentation.css">
</head>
<body>
  <header class="documentation-header"><a href="/#/overview">Fylkren</a><a href="/documentation/">Documentation</a><span>Version ${escapeHtml(version)}</span></header>
  <main class="documentation-content">${body}</main>
</body>
</html>`;
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(fullPath));
    else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

async function renderDocument(source) {
  const output = outputForSource(source);
  if (!output) throw new Error(`No documentation output mapping for ${source}`);
  const markdown = await readFile(source, 'utf8');
  let documentTitle = path.basename(source, '.md');
  const headingSlugs = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const content = this.parser.parseInline(tokens);
        if (depth === 1) documentTitle = tokens.map(token => token.raw).join('').trim() || documentTitle;
        const baseSlug = slug(content);
        const occurrence = headingSlugs.get(baseSlug) ?? 0;
        headingSlugs.set(baseSlug, occurrence + 1);
        const identifier = occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`;
        return `<h${depth} id="${identifier}">${content}</h${depth}>`;
      },
      link({ href, title, tokens }) {
        const target = localLink(source, output, href);
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(target)}"${titleAttribute}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  const body = (await marked.parse(markdown)).replace(/href="([^"]+\.md(?:#[^"]*)?)"/gi, (_match, href) => `href="${escapeHtml(localLink(source, output, href))}"`);
  if (/<script\b|\son\w+\s*=/i.test(body))
    throw new Error(`Unsafe active content in ${path.relative(repositoryRoot, source)}`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, pageTemplate(documentTitle, body));
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const source of [...await markdownFiles(documentationRoot), ...repositoryDocuments.map(name => path.join(repositoryRoot, name))])
  await renderDocument(source);

for (const entry of await readdir(documentationRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  await cp(path.join(documentationRoot, entry.name), path.join(outputRoot, entry.name), {
    recursive: true,
    filter: source => !source.endsWith('.md'),
  });
}
await cp(path.join(repositoryRoot, 'assets'), path.join(outputRoot, 'repository', 'assets'), { recursive: true });

await writeFile(path.join(outputRoot, 'documentation.css'), `
:root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.55; }
body { margin: 0; color: #17211f; background: #f4f6f5; }
.documentation-header { position: sticky; top: 0; z-index: 2; display: flex; gap: 1rem; align-items: center; padding: .7rem max(1rem, calc((100vw - 1080px) / 2)); color: #fff; background: #202020; }
.documentation-header a { color: inherit; font-weight: 700; text-decoration: none; }
.documentation-header span { margin-left: auto; color: #d8dfdd; font-size: .9rem; }
.documentation-content { box-sizing: border-box; max-width: 1080px; min-height: 100vh; margin: 0 auto; padding: 1.5rem 2rem 4rem; background: #fff; box-shadow: 0 0 24px rgb(0 0 0 / 7%); }
h1, h2, h3, h4 { line-height: 1.25; scroll-margin-top: 4.5rem; }
h2 { margin-top: 2rem; padding-top: .35rem; border-top: 1px solid #dbe2e0; }
a { color: #155d50; }
img { max-width: 100%; height: auto; }
pre, code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
code { padding: .1rem .25rem; border-radius: 3px; background: #eef2f1; }
pre { overflow: auto; padding: 1rem; border-radius: 6px; background: #17211f; color: #f4f6f5; }
pre code { padding: 0; background: transparent; }
table { display: block; overflow-x: auto; width: 100%; border-collapse: collapse; }
th, td { padding: .5rem .65rem; border: 1px solid #ccd6d3; text-align: left; vertical-align: top; }
blockquote { margin-left: 0; padding-left: 1rem; border-left: 4px solid #315c53; color: #475450; }
@media (max-width: 700px) { .documentation-content { padding: 1rem; } .documentation-header { gap: .65rem; } }
@media (prefers-color-scheme: dark) { body { color: #edf3f1; background: #111715; } .documentation-content { background: #18201e; } a { color: #82cdbf; } code { background: #28332f; } th, td { border-color: #475650; } }
`);

console.log(`Built local Fylkren ${version} documentation.`);
