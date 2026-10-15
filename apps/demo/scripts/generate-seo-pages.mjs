import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const site = 'https://mfuryto.github.io/fylkren';

const pages = [
  {
    slug: 'task-management',
    title: 'Operational task management',
    description: 'Coordinate operational assignments with ownership, deadlines, lifecycle status, stable references and traceable activity.',
    demo: 'tasks',
    points: ['Shared assignment overview', 'Clear ownership and deadlines', 'Dependencies, decisions, comments and activity history']
  },
  {
    slug: 'planning-and-templates',
    title: 'Planning and configurable workflow templates',
    description: 'Turn intent into executable plans with configurable templates, approval gates, timelines and reusable ways of working.',
    demo: 'planning',
    points: ['Configurable planning sections', 'Reusable operational templates', 'Human approval of AI-assisted suggestions']
  },
  {
    slug: 'execution-and-reporting',
    title: 'Controlled execution and operational reporting',
    description: 'Follow execution against the approved plan and create consistent reports from controlled source data.',
    demo: 'execution',
    points: ['Progress linked to the assignment', 'Decisions and dependencies in context', 'Reports with stable source references']
  },
  {
    slug: 'risk-management',
    title: 'Operational risk and measure management',
    description: 'Assess risk before treatment, assign measures and visualize the movement to residual risk in a 5 × 5 matrix.',
    demo: 'risk',
    points: ['Initial and residual risk', 'Owned measures with deadlines', 'Visual treatment effect and human-confirmed assessments']
  },
  {
    slug: 'continuous-learning',
    title: 'Continuous learning from operational work',
    description: 'Capture, prioritize, assign and treat learning points without exposing internal lessons in external final reports.',
    demo: 'learning',
    points: ['Learning linked to its originating assignment', 'Individual priority, ownership and status', 'Continuous improvement beyond final reporting']
  },
  {
    slug: 'multilingual-ai-assisted',
    title: 'Multilingual and optional AI-assisted operations',
    description: 'Use a multilingual interface and optional AI assistance with either a local or hosted compatible provider.',
    demo: 'overview',
    points: ['19 bundled interface languages', 'Optional local or hosted AI provider', 'Editable suggestions with people retaining control']
  },
  {
    slug: 'self-hosted-air-gapped',
    title: 'Self-hosted and air-gapped operational software',
    description: 'Run Fylkren under local control, including isolated environments without a vendor cloud dependency.',
    demo: 'workflows',
    points: ['Self-hosted deployment', 'Offline documentation and language resources', 'Designed for isolated and air-gapped networks']
  }
];

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const style = `
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#102a43;background:#f4f7fa}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:980px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between}header a{color:#102a43;font-weight:800;text-decoration:none}.badge{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#526b7f}main{margin-top:5vh;background:#fff;border:1px solid #d8e2ea;border-radius:18px;padding:clamp(28px,6vw,64px);box-shadow:0 18px 50px #102a4312}h1{max-width:760px;font-size:clamp(2.2rem,6vw,4.4rem);line-height:1.02;letter-spacing:-.045em;margin:.25em 0}p{max-width:760px;font-size:1.15rem;line-height:1.7;color:#40566a}ul{display:grid;gap:12px;padding:0;margin:32px 0;list-style:none}li{padding:16px 18px;border-left:4px solid #2c7a7b;background:#f1f7f7;font-weight:650}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:36px}.actions a{padding:13px 18px;border-radius:9px;text-decoration:none;font-weight:750}.primary{color:#fff;background:#102a43}.secondary{color:#102a43;border:1px solid #b7c7d3}footer{font-size:.9rem;color:#617789}@media(max-width:600px){header,main,footer{padding:20px}main{margin:0;border-radius:0}}`;

for (const page of pages) {
  const url = `${site}/features/${page.slug}/`;
  const title = `${page.title} | Fylkren`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="Fylkren"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${site}/fylkren-social-preview.png"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.description, url, isPartOf: { '@type': 'WebSite', name: 'Fylkren', url: `${site}/` }, about: { '@type': 'SoftwareApplication', name: 'Fylkren', applicationCategory: 'BusinessApplication' } })}</script><style>${style}</style></head>
<body><header><a href="${site}/">Fylkren</a><span class="badge">Product capability</span></header><main><span class="badge">Self-hosted operational software</span><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><ul>${page.points.map(point => `<li>${escape(point)}</li>`).join('')}</ul><div class="actions"><a class="primary" href="${site}/#${page.demo}">Explore the interactive demo</a><a class="secondary" href="https://github.com/mfuryto/fylkren">View source and editions</a></div></main><footer>Fylkren · operational task and mission management</footer></body></html>`;
  const directory = path.join(dist, 'features', page.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
