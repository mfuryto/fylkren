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
    <ProductShell mode="demo" logoUrl="/fylkren-logo.png">
      <div className="page">
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
      </div>
    </ProductShell>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
