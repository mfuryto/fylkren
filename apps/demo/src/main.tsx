import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductShell } from '@fylkren/ui';
import { exampleTasks } from './fixtures';
import './demo.css';

function Demo() {
  const summaries = [
    ['Active', '8'],
    ['Near deadline', '3'],
    ['Blocked', '1'],
    ['Requires attention', '2']
  ] as const;

  return (
    <ProductShell mode="demo" logoUrl="./fylkren-logo.png">
      <div className="page">
        <section className="demo-intro" aria-labelledby="demo-title">
          <div>
            <p className="demo-eyebrow">Read-only product demo</p>
            <h1 id="demo-title">Operational work with ownership, traceability and local control</h1>
            <p>This static preview uses fictional data. Fylkren supports controlled assignments, planning, execution, risk, reporting and continuous learning across organizational levels.</p>
          </div>
          <div className="demo-actions">
            <a className="primary-button" href="https://github.com/mfuryto/fylkren">View source and editions</a>
            <a className="secondary-button" href="https://github.com/mfuryto/fylkren/blob/main/docs/README.md">Read documentation</a>
          </div>
          <ul className="demo-capabilities" aria-label="Product characteristics">
            <li><strong>19 languages</strong><span>Bundled for offline use</span></li>
            <li><strong>Optional AI</strong><span>Local or hosted provider</span></li>
            <li><strong>Air-gapped ready</strong><span>No vendor cloud dependency</span></li>
            <li><strong>Community + Enterprise</strong><span>One upgrade path</span></li>
          </ul>
        </section>
        <header className="page-header">
          <div>
            <h1>Work overview</h1>
            <p className="muted">Synthetic sample data. Content cannot be changed.</p>
          </div>
        </header>
        <div className="summary-grid" aria-label="Task summary">
          {summaries.map(([label, value]) => (
            <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        <div className="panel task-list">
          <div className="section-heading"><h2>Prioritized tasks</h2><span className="muted">3 of 12</span></div>
          {exampleTasks.map(task => (
            <article className="task-row" key={task.id}>
              <span>{task.id}</span><strong>{task.title}</strong><span>{task.owner}</span><span>{task.status}</span>
            </article>
          ))}
        </div>
        <footer className="demo-footer">
          Fylkren · self-hosted operational task and mission management · synthetic demo data
        </footer>
      </div>
    </ProductShell>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
